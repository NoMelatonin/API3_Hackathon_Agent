// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {AirnodeV2Attestation} from "./vendor/AirnodeV2Attestation.sol";
import {ProjectedJson} from "./vendor/ProjectedJson.sol";

/// @notice One immutable historical relief exercise. No admin, upgrades or withdrawal path.
/// @dev Intended ONLY for testnet use with DemoUSD. API3 signs what USGS returned, not humanitarian need.
contract DisasterFund is ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint256 public constant GRANT = 1_000 * 10 ** 6;
    uint256 public constant TOTAL_BUDGET = 3 * GRANT;
    uint256 public constant MAX_RESPONSE_AGE = 5 minutes;
    uint256 public constant MIN_MAGNITUDE = 700; // Two decimals, 7.00.
    uint256 public constant EVENT_START = 1675641600; // 2023-02-06 00:00 UTC.
    uint256 public constant EVENT_END = 1675728000; // Exclusive.
    bytes32 public constant EVENT_ID_HASH = keccak256("us6000jllz");

    IERC20 public immutable token;
    address public immutable airnode;
    bytes32 public immutable requestHash;
    address[3] public ngos;
    address[3] public committee;
    mapping(address => bool) public eligible;
    mapping(address => bool) public claimed;
    mapping(address => uint8) private committeeBit;
    mapping(address => mapping(bytes32 => uint8)) public approvals;
    bool public active;
    uint256 public activatedAt;
    uint256 public totalPaid;

    enum Path { Oracle, Emergency }

    error InvalidConfiguration();
    error NotActive();
    error AlreadyActive();
    error InsufficientFunds();
    error IneligibleRecipient();
    error AlreadyClaimed();
    error ResponseTooOld();
    error FutureResponse();
    error ResponseBeforeActivation();
    error WrongEvent();
    error TriggerNotMet();
    error ObservationOutsideWindow();
    error OutsideRegion();
    error NotCommittee();
    error InvalidReason();
    error AlreadyApproved();
    error QuorumNotMet();

    event Deposited(address indexed donor, uint256 amount);
    event Activated(uint256 timestamp);
    event EmergencyApproved(address indexed ngo, bytes32 indexed reasonHash, address indexed approver);
    event Paid(address indexed ngo, uint256 amount, Path path, bytes32 evidenceHash);

    constructor(IERC20 token_, address airnode_, bytes32 requestHash_, address[3] memory ngos_, address[3] memory committee_) {
        if (address(token_).code.length == 0 || airnode_ == address(0) || requestHash_ == bytes32(0)) {
            revert InvalidConfiguration();
        }
        token = token_;
        airnode = airnode_;
        requestHash = requestHash_;
        for (uint256 i; i < 3; ++i) {
            if (ngos_[i] == address(0) || committee_[i] == address(0)) revert InvalidConfiguration();
            for (uint256 j; j < 3; ++j) {
                if (ngos_[i] == committee_[j]) revert InvalidConfiguration();
                if (i != j && (ngos_[i] == ngos_[j] || committee_[i] == committee_[j])) revert InvalidConfiguration();
            }
            eligible[ngos_[i]] = true;
            committeeBit[committee_[i]] = uint8(1 << i);
        }
        ngos = ngos_;
        committee = committee_;
    }

    function deposit(uint256 amount) external nonReentrant {
        if (amount == 0) revert InsufficientFunds();
        token.safeTransferFrom(msg.sender, address(this), amount);
        emit Deposited(msg.sender, amount);
    }

    /// @notice Anyone may activate the fully funded, already immutable rules.
    function activate() external {
        if (active) revert AlreadyActive();
        if (token.balanceOf(address(this)) < TOTAL_BUDGET) revert InsufficientFunds();
        active = true;
        activatedAt = block.timestamp;
        emit Activated(block.timestamp);
    }

    /// @notice The caller is just a messenger; payout ALWAYS goes to the fixed NGO address.
    function claim(address ngo, uint256 timestamp, bytes calldata data, bytes calldata signature) external nonReentrant {
        if (!active) revert NotActive();
        AirnodeV2Attestation.verify(airnode, requestHash, timestamp, data, signature);
        if (timestamp > block.timestamp) revert FutureResponse();
        if (block.timestamp - timestamp > MAX_RESPONSE_AGE) revert ResponseTooOld();
        if (timestamp < activatedAt) revert ResponseBeforeActivation();
        if (keccak256(bytes(ProjectedJson.readString(data, "eventId"))) != EVENT_ID_HASH
            || keccak256(bytes(ProjectedJson.readString(data, "eventType"))) != keccak256("earthquake")) revert WrongEvent();
        if (keccak256(bytes(ProjectedJson.readString(data, "status"))) != keccak256("reviewed")
            || ProjectedJson.readUint(data, "magnitude", 2) < MIN_MAGNITUDE) revert TriggerNotMet();
        uint256 eventTime = ProjectedJson.readUint(data, "eventTime", 0) / 1000;
        if (eventTime < EVENT_START || eventTime >= EVENT_END) revert ObservationOutsideWindow();
        int256 latitude = ProjectedJson.readInt(data, "latitude", 6);
        int256 longitude = ProjectedJson.readInt(data, "longitude", 6);
        if (latitude < 36_000_000 || latitude > 39_000_000 || longitude < 35_000_000 || longitude > 39_000_000) {
            revert OutsideRegion();
        }
        _pay(ngo, Path.Oracle, keccak256(abi.encode(timestamp, data, signature)));
    }

    /// @notice Two distinct independent demo committee members approve the exact NGO/reason pair.
    function approveEmergency(address ngo, bytes32 reasonHash) external {
        uint8 bit = committeeBit[msg.sender];
        if (bit == 0) revert NotCommittee();
        _checkClaim(ngo);
        if (reasonHash == bytes32(0)) revert InvalidReason();
        if (approvals[ngo][reasonHash] & bit != 0) revert AlreadyApproved();
        approvals[ngo][reasonHash] |= bit;
        emit EmergencyApproved(ngo, reasonHash, msg.sender);
    }

    /// @notice Overrides the oracle requirement, never the one-grant-per-NGO limit.
    function executeEmergency(address ngo, bytes32 reasonHash) external nonReentrant {
        uint8 mask = approvals[ngo][reasonHash];
        // Exactly three possible bits; at least two set bits is the 2-of-3 quorum.
        if (mask == 0 || (mask & (mask - 1)) == 0) revert QuorumNotMet();
        _pay(ngo, Path.Emergency, reasonHash);
    }

    function remainingBudget() external view returns (uint256) { return TOTAL_BUDGET - totalPaid; }

    function _checkClaim(address ngo) private view {
        if (!active) revert NotActive();
        if (!eligible[ngo]) revert IneligibleRecipient();
        if (claimed[ngo]) revert AlreadyClaimed();
    }

    function _pay(address ngo, Path path, bytes32 evidenceHash) private {
        _checkClaim(ngo);
        if (totalPaid + GRANT > TOTAL_BUDGET || token.balanceOf(address(this)) < GRANT) revert InsufficientFunds();
        claimed[ngo] = true;
        totalPaid += GRANT;
        token.safeTransfer(ngo, GRANT);
        emit Paid(ngo, GRANT, path, evidenceHash);
    }
}
