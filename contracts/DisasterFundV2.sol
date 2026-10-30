// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {AirnodeV2Attestation} from "./vendor/AirnodeV2Attestation.sol";
import {PayoutMath} from "./PayoutMath.sol";
import {StrictJson} from "./StrictJson.sol";
import {ProjectedJson} from "./vendor/ProjectedJson.sol";

/// @notice Three immutable historical campaigns sharing a fully reserved demo pool. No admin or upgrades.
/// @dev Intended ONLY for valueless demo tokens. Airnodes authenticate source data, not humanitarian need.
contract DisasterFundV2 is ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint256 public constant EMERGENCY_GRANT = 1_000 * 1e6;
    uint256 public constant CAMPAIGN_BUDGET = 6_000 * 1e6;
    uint256 public constant TOTAL_BUDGET = 3 * CAMPAIGN_BUDGET;
    uint256 public constant MAX_RESPONSE_AGE = 5 minutes;
    struct Campaign {
        address airnode;
        bytes32 requestHash;
        uint256 threshold;
        uint256 cap;
        uint256 minimum;
        uint256 maximum;
        bool oracleEnabled;
    }
    Campaign[3] public campaigns;
    uint256[3] public campaignPaid;
    uint256 public payoutCount;
    IERC20 public immutable token;
    address[3] public ngos;
    address[3] public committee;
    mapping(address => bool) public eligible;
    mapping(uint8 => mapping(address => bool)) public claimed;
    mapping(address => uint8) private committeeBit;
    mapping(uint8 => mapping(address => mapping(bytes32 => uint8))) public approvals;
    bool public active;
    uint256 public activatedAt;
    uint256 public totalPaid;

    enum Path { Oracle, Emergency }

    error InvalidConfiguration();
    error InvalidCampaign();
    error OracleDisabled();
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
    event EmergencyApproved(uint8 indexed campaign, address indexed ngo, bytes32 indexed reasonHash, address approver);
    event Paid(uint8 indexed campaign, address indexed ngo, uint256 amount, Path path, bytes32 evidenceHash);

    constructor(IERC20 token_, Campaign[3] memory campaigns_, address[3] memory ngos_, address[3] memory committee_) {
        if (address(token_).code.length == 0) revert InvalidConfiguration();
        token = token_;
        for (uint8 i; i < 3; ++i) {
            Campaign memory c = campaigns_[i];
            if (c.airnode == address(0) || c.requestHash == bytes32(0) || c.maximum != 2_000 * 1e6
                || c.minimum > EMERGENCY_GRANT || c.minimum == 0 || c.threshold == 0 || c.cap <= c.threshold
                || c.cap > 1_000_000 * 1e6 || (i == 0 && c.cap - c.threshold > 2e6)) revert InvalidConfiguration();
            campaigns[i] = c;
        }
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

    function _campaign(uint8 id) private pure { if (id >= 3) revert InvalidCampaign(); }

    /// @notice Authenticates and validates data, then computes the exact amount without consuming a claim.
    function quote(uint8 id, uint256 timestamp, bytes calldata data, bytes calldata signature) public view returns (uint256) {
        _campaign(id);
        if (!active) revert NotActive();
        Campaign memory c = campaigns[id];
        if (!c.oracleEnabled) revert OracleDisabled();
        AirnodeV2Attestation.verify(c.airnode, c.requestHash, timestamp, data, signature);
        if (timestamp > block.timestamp) revert FutureResponse();
        if (block.timestamp - timestamp > MAX_RESPONSE_AGE) revert ResponseTooOld();
        if (timestamp < activatedAt) revert ResponseBeforeActivation();
        StrictJson.validate(data);
        uint256 amount = PayoutMath.payout(id, _severity(id, data), c.threshold, c.cap, c.minimum, c.maximum);
        if (amount == 0) revert TriggerNotMet();
        return amount;
    }

    function claim(uint8 id, address ngo, uint256 timestamp, bytes calldata data, bytes calldata signature) external nonReentrant {
        _checkClaim(id, ngo);
        uint256 amount = quote(id, timestamp, data, signature);
        _pay(id, ngo, amount, Path.Oracle, keccak256(abi.encode(timestamp, data, signature)));
    }

    function _eq(bytes memory data, string memory key, string memory expected) private pure returns (bool) {
        return keccak256(bytes(ProjectedJson.readString(data, key))) == keccak256(bytes(expected));
    }

    function _severity(uint8 id, bytes memory data) private pure returns (uint256) {
        if (id == 0) {
            if (!_eq(data, "eventId", "us6000jllz") || !_eq(data, "eventType", "earthquake")) revert WrongEvent();
            if (!_eq(data, "status", "reviewed")) revert TriggerNotMet();
            uint256 time = StrictJson.integer(data, "eventTime");
            if (time < 1675641600000 || time >= 1675728000000) revert ObservationOutsideWindow();
            _region(data, 36e6, 39e6, 35e6, 39e6);
            return StrictJson.number(data, "magnitude");
        }
        if (id == 1) {
            if (!_eq(data, "eventId", "EONET_22386") || !_eq(data, "category", "severeStorms")
                || !_eq(data, "source", "JTWC") || !_eq(data, "unit", "kts") || !_eq(data, "geometryType", "Point")) revert WrongEvent();
            if (ProjectedJson.readTimestamp(data, "observedAt") != 1786341600) revert ObservationOutsideWindow();
            _region(data, 26e6, 29e6, 160e6, 162e6);
            return StrictJson.number(data, "windSpeed");
        }
        if (!_eq(data, "indicator", "MALARIA_EST_INCIDENCE") || !_eq(data, "country", "NGA")
            || !_eq(data, "spatialType", "COUNTRY") || StrictJson.integer(data, "year") != 2022
            || StrictJson.integer(data, "count") != 1 || StrictJson.integer(data, "recordId") == 0
            || !ProjectedJson.isNull(data, "dim1") || !ProjectedJson.isNull(data, "dim2") || !ProjectedJson.isNull(data, "dim3")) revert WrongEvent();
        uint256 incidence = StrictJson.number(data, "incidence");
        bool lowNull = ProjectedJson.isNull(data, "low");
        bool highNull = ProjectedJson.isNull(data, "high");
        if (lowNull != highNull) revert WrongEvent();
        if (!lowNull && (StrictJson.number(data, "low") > incidence || StrictJson.number(data, "high") < incidence)) revert WrongEvent();
        return incidence;
    }

    function _region(bytes memory data, int256 south, int256 north, int256 west, int256 east) private pure {
        int256 lat = StrictJson.signedNumber(data, "latitude");
        int256 lon = StrictJson.signedNumber(data, "longitude");
        if (lat < south || lat > north || lon < west || lon > east) revert OutsideRegion();
    }

    /// @notice Two distinct independent demo committee members approve the exact NGO/reason pair.
    function approveEmergency(uint8 id, address ngo, bytes32 reasonHash) external {
        uint8 bit = committeeBit[msg.sender];
        if (bit == 0) revert NotCommittee();
        _checkClaim(id, ngo);
        if (reasonHash == bytes32(0)) revert InvalidReason();
        if (approvals[id][ngo][reasonHash] & bit != 0) revert AlreadyApproved();
        approvals[id][ngo][reasonHash] |= bit;
        emit EmergencyApproved(id, ngo, reasonHash, msg.sender);
    }

    /// @notice Overrides the oracle requirement, never the one-grant-per-NGO limit.
    function executeEmergency(uint8 id, address ngo, bytes32 reasonHash) external nonReentrant {
        _checkClaim(id, ngo);
        uint8 mask = approvals[id][ngo][reasonHash];
        // Exactly three possible bits; at least two set bits is the 2-of-3 quorum.
        if (mask == 0 || (mask & (mask - 1)) == 0) revert QuorumNotMet();
        _pay(id, ngo, EMERGENCY_GRANT, Path.Emergency, reasonHash);
    }

    function remainingBudget() external view returns (uint256) { return TOTAL_BUDGET - totalPaid; }

    function _checkClaim(uint8 id, address ngo) private view {
        if (!active) revert NotActive();
        _campaign(id);
        if (!eligible[ngo]) revert IneligibleRecipient();
        if (claimed[id][ngo]) revert AlreadyClaimed();
    }

    function _pay(uint8 id, address ngo, uint256 amount, Path path, bytes32 evidenceHash) private {
        _checkClaim(id, ngo);
        if (campaignPaid[id] + amount > CAMPAIGN_BUDGET || totalPaid + amount > TOTAL_BUDGET || token.balanceOf(address(this)) < amount) revert InsufficientFunds();
        claimed[id][ngo] = true;
        totalPaid += amount;
        campaignPaid[id] += amount;
        ++payoutCount;
        token.safeTransfer(ngo, amount);
        emit Paid(id, ngo, amount, path, evidenceHash);
    }
}
