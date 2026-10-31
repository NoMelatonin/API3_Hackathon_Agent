// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {DisasterFundV3} from "./DisasterFundV3.sol";
import {AirnodeV2Attestation} from "./vendor/AirnodeV2Attestation.sol";
import {ProjectedJson} from "./vendor/ProjectedJson.sol";

abstract contract OracleTypes {
    struct Policy {
        bytes32 incident;
        address airnode;
        bytes32 requestHash;
        bytes32 eventId;
        uint8 kind;
        bool synthetic;
        bool enabled;
    }
}

contract V3OracleVerifier is OracleTypes {
    error OracleInvalid();
    error OracleStale();
    error ObservationStale();
    error FundingRuleNotMet();

    function verify(Policy calldata p, uint256 timestamp, bytes calldata data, bytes calldata sig)
        external
        view
        returns (uint256 value)
    {
        uint256 slot = p.kind;
        if (!p.enabled || timestamp > block.timestamp || block.timestamp - timestamp > 5 minutes) revert OracleStale();
        AirnodeV2Attestation.verify(p.airnode, p.requestHash, timestamp, data, sig);
        if (keccak256(bytes(ProjectedJson.readString(data, "eventId"))) != p.eventId) revert OracleInvalid();
        int256 lat = ProjectedJson.readInt(data, "latitude", 6);
        int256 lon = ProjectedJson.readInt(data, "longitude", 6);
        uint256 observed;
        if (p.synthetic) {
            if (!ProjectedJson.readBool(data, "synthetic")) revert OracleInvalid();
            bytes32 unit = keccak256(bytes(ProjectedJson.readString(data, "unit")));
            if (unit != keccak256(bytes(slot == 0 ? "magnitude" : slot == 1 ? "kts" : "level"))) revert OracleInvalid();
            value = ProjectedJson.readUint(data, "severity", 2);
            observed = ProjectedJson.readUint(data, "observedAt", 0);
        } else if (slot == 0) {
            if (
                keccak256(bytes(ProjectedJson.readString(data, "eventType"))) != keccak256("earthquake")
                    || keccak256(bytes(ProjectedJson.readString(data, "status"))) != keccak256("reviewed")
            ) revert OracleInvalid();
            value = ProjectedJson.readUint(data, "magnitude", 2);
            observed = ProjectedJson.readUint(data, "eventTime", 0) / 1000;
        } else {
            if (
                keccak256(bytes(ProjectedJson.readString(data, "unit"))) != keccak256("kts")
                    || keccak256(bytes(ProjectedJson.readString(data, "category"))) != keccak256("severeStorms")
            ) revert OracleInvalid();
            value = ProjectedJson.readUint(data, "windSpeed", 2);
            observed = ProjectedJson.readTimestamp(data, "observedAt");
        }
        if (observed > timestamp || timestamp - observed > 1 days) revert ObservationStale();
        if (slot == 0
                ? (lat < 36e6 || lat > 39e6 || lon < 35e6 || lon > 39e6)
                : slot == 1
                    ? (lat < 10e6 || lat > 18e6 || lon < 120e6 || lon > 125e6)
                    : (lat < -26e6 || lat > -11e6 || lon < 32e6 || lon > 40e6)) revert OracleInvalid();
        if (value < (slot == 0 ? 700 : slot == 1 ? 3400 : 200) || (slot >= 2 && value > 300)) revert FundingRuleNotMet();
    }
}

/// @notice Local demo policy v1. Hazard thresholds are funding rules, not verified humanitarian need.
contract DisasterFundV3Auto is DisasterFundV3, OracleTypes {
    V3OracleVerifier public immutable oracleVerifier;

    struct AutoRequest {
        uint256 slot;
        uint256 requested;
        uint256 capacity;
        uint256 externalFunding;
        uint256 timestamp;
        bytes data;
        bytes signature;
    }
    Policy[] public policies;
    bytes32[] private automaticHolds;
    mapping(bytes32 => uint256) public peak;
    mapping(uint256 => uint256) public applicationSeverity;
    mapping(uint256 => bool) public automaticApplication;
    mapping(bytes32 => uint256) public externalFor;
    mapping(uint256 => bytes32) public purposeHash;
    mapping(bytes32 => uint256) public submittedRequest;
    mapping(bytes32 => bytes32) private submittedContent;
    mapping(uint256 => uint256) public automaticReservation;
    event OraclePurpose(uint256 indexed id, bytes32 purpose);
    event OracleApplication(uint256 indexed id, bytes32 proof, bool synthetic, bool authorized);

    constructor(
        IERC20 t,
        address[3] memory n,
        address[3] memory d,
        address[3] memory e,
        address[3] memory a,
        Policy[] memory p
    ) DisasterFundV3(t, n, d, e, a) {
        oracleVerifier = new V3OracleVerifier();
        require(p.length == 4, "Four fixed policies");
        for (uint256 i; i < p.length; i++) {
            require(p[i].kind == i && p[i].airnode != address(0), "Policy");
            policies.push(p[i]);
        }
    }

    function automaticEligibility(AutoRequest calldata r) external view returns (bool authorized, uint256 severity) {
        if (r.slot >= policies.length || ngoBit[msg.sender] == 0) revert Unauthorized();
        severity = oracleVerifier.verify(policies[r.slot], r.timestamp, r.data, r.signature);
        bytes32 key = keyFor(msg.sender, policies[r.slot].incident);
        authorized = paidFor[key] == 0 || acceptedHistory(msg.sender)
            || (peak[key] > 0 && severity >= peak[key] + (r.slot == 0 ? 20 : r.slot == 1 ? 500 : 100));
        uint256 id = openApplication[key];
        if (
            id > 0 && automaticApplication[id] && applications[id].authorized
                && block.timestamp <= applications[id].createdAt + 72 hours
        ) authorized = true;
    }

    function effectiveReserved() public view returns (uint256 value) {
        value = totalReserved;
        for (uint256 i; i < automaticHolds.length; i++) {
            if (block.timestamp > holdExpires[automaticHolds[i]]) value -= roundHolds[automaticHolds[i]];
        }
    }

    function releaseAutomaticHolds() public {
        for (uint256 i; i < automaticHolds.length; i++) {
            bytes32 h = automaticHolds[i];
            if (block.timestamp > holdExpires[h] && roundHolds[h] > 0) {
                totalReserved -= roundHolds[h];
                roundHolds[h] = 0;
            }
        }
    }

    /// @notice Preview uses the same fixed equal-weight package allocation as settlement.
    function automaticQuote(uint256 slot, uint256 requested, uint256 capacity, uint256 externalFunding)
        public
        view
        returns (uint256 amount, uint256 provisional, uint256 nextRound)
    {
        if (slot >= policies.length || ngoBit[msg.sender] == 0) revert Unauthorized();
        uint256 free = token.balanceOf(address(this)) - effectiveReserved();
        uint256 budget = free - free * 20 / 100; // unsupported coverage remains uncertain
        uint256 count = policies.length * 3;
        uint256[] memory limits = new uint256[](count);
        uint256[] memory amounts = new uint256[](count);
        uint256 target;
        for (uint256 j; j < count; j++) {
            address ngo = ngos[j % 3];
            bytes32 key = keyFor(ngo, policies[j / 3].incident);
            uint256 spent =
                paidFor[key] + reservedFor[key]
                    + (ngo == msg.sender && j / 3 == slot ? externalFunding : externalFor[key]);
            uint256 ceiling = CAP * 90 / 100;
            uint256 limit = spent >= ceiling || isBlocked(ngo) ? 0 : ceiling - spent;
            if (ngo == msg.sender && j / 3 == slot) {
                target = j;
                if (limit > requested) limit = requested;
                if (limit > capacity) limit = capacity;
            }
            limits[j] = limit;
        }
        // Equal fixed weights. Round remainders use stable policy-slot/NGO order.
        while (budget > 0) {
            uint256 active;
            for (uint256 j; j < count; j++) {
                if (amounts[j] < limits[j]) active++;
            }
            if (active == 0) break;
            uint256 share = budget / active;
            uint256 used;
            for (uint256 j; j < count; j++) {
                if (amounts[j] < limits[j]) {
                    uint256 add = share == 0 ? 1 : share;
                    if (add > limits[j] - amounts[j]) add = limits[j] - amounts[j];
                    if (add > budget - used) add = budget - used;
                    amounts[j] += add;
                    used += add;
                }
            }
            budget -= used;
        }
        amount = amounts[target];
        for (uint256 j; j < count; j++) {
            if (j != target) provisional += amounts[j];
        }
        nextRound = lastRoundAt == 0 ? 0 : lastRoundAt + 6 hours;
    }

    /// @notice Application only: no reservation and no transfer. Retries bind immutable content.
    function automaticSubmit(AutoRequest calldata r, bytes32 purpose, bytes32 requestId)
        external returns (uint256 id)
    {
        if (r.slot >= policies.length || ngoBit[msg.sender] == 0) revert Unauthorized();
        if (purpose == 0 || requestId == 0 || r.requested == 0 || r.requested > CAP || r.capacity == 0 || r.capacity > CAP) revert Invalid();
        bytes32 retry = keccak256(abi.encode(msg.sender, requestId));
        bytes32 content = keccak256(abi.encode(r.slot, r.requested, r.capacity, r.externalFunding, purpose));
        id = submittedRequest[retry];
        if (id != 0) {
            if (submittedContent[retry] != content) revert Invalid();
            return id;
        }
        if (isBlocked(msg.sender)) revert Blocked();
        uint256 severity = oracleVerifier.verify(policies[r.slot], r.timestamp, r.data, r.signature);
        bytes32 key = keyFor(msg.sender, policies[r.slot].incident);
        if (reservedFor[key] > 0 || openApplication[key] != 0) revert Blocked();
        // Authorization is recalculated at reservation time; peer votes remain separate.
        id = ++applicationCount;
        bytes32 proof = keccak256(abi.encode(r.timestamp, r.data, r.signature));
        assessments[id] = Assessment(msg.sender, policies[r.slot].incident, 1,
            keccak256("fixed-equal-package-policy-v1"), proof, CAP,
            block.timestamp + 7 days, id, r.slot == 3 ? 45 : 30);
        applications[id] = Application(key, assessmentHash(assessments[id]), msg.sender,
            r.requested, r.capacity, r.externalFunding, block.timestamp,
            uint8(7) & ~ngoBit[msg.sender], 0, paidFor[key] > 0, false, false);
        openApplication[key] = id;
        automaticApplication[id] = true;
        applicationSeverity[id] = severity;
        purposeHash[id] = purpose;
        submittedRequest[retry] = id;
        submittedContent[retry] = content;
        emit ApplicationOpened(id, msg.sender, policies[r.slot].incident, applications[id].assessment);
        emit OracleApplication(id, proof, policies[r.slot].synthetic, false);
        emit OraclePurpose(id, purpose);
    }

    /// @notice Fresh source and current budget authorize a reservation, never a transfer.
    function automaticReserve(uint256 id, AutoRequest calldata r) external returns (uint256 rid) {
        Application storage app = applications[id];
        if (app.ngo != msg.sender || !automaticApplication[id] || r.slot >= policies.length) revert Unauthorized();
        if (app.requested != r.requested || app.capacity != r.capacity || app.externalFunding != r.externalFunding
            || assessments[id].incident != policies[r.slot].incident) revert Invalid();
        rid = automaticReservation[id];
        if (rid != 0) return rid;
        if (app.consumed || isBlocked(msg.sender) || reservedFor[app.key] > 0) revert Blocked();
        if (block.timestamp > app.createdAt + 72 hours) revert Expired();
        uint256 severity = oracleVerifier.verify(policies[r.slot], r.timestamp, r.data, r.signature);
        bool authorized = app.authorized || paidFor[app.key] == 0 || acceptedHistory(msg.sender)
            || (peak[app.key] > 0 && severity >= peak[app.key] + (r.slot == 0 ? 20 : r.slot == 1 ? 500 : 100));
        if (!authorized) revert Unauthorized();
        releaseAutomaticHolds();
        (uint256 amount, uint256 provisional, uint256 nextRound) =
            automaticQuote(r.slot, r.requested, r.capacity, r.externalFunding);
        if (block.timestamp < nextRound) revert Blocked();
        if (amount == 0) revert Budget();
        bytes32 snapshot = keccak256(abi.encode(address(this), roundNonce, app.key));
        if (provisional > 0) {
            automaticHolds.push(snapshot);
            roundHolds[snapshot] = provisional;
            holdExpires[snapshot] = block.timestamp + 24 hours;
            totalReserved += provisional;
        }
        usedRoundSnapshot[snapshot] = true;
        externalFor[app.key] = r.externalFunding;
        app.consumed = true;
        openApplication[app.key] = 0;
        reservedFor[app.key] += amount;
        totalReserved += amount;
        rid = ++reservationCount;
        automaticReservation[id] = rid;
        applicationSeverity[id] = severity;
        reservations[rid] = Reservation(id, amount, block.timestamp + 24 hours, assessments[id].deadlineDays, false);
        emit Reserved(rid, id, amount, block.timestamp + 24 hours);
        lastRoundAt = block.timestamp;
        roundNonce++;
        emit RoundClosed(snapshot, roundNonce - 1, token.balanceOf(address(this)), amount + provisional,
            (token.balanceOf(address(this)) - totalReserved + amount + provisional) * 20 / 100);
    }

    function _afterClaim(uint256 id) internal override {
        bytes32 key = applications[id].key;
        if (automaticApplication[id] && applicationSeverity[id] > peak[key]) peak[key] = applicationSeverity[id];
    }
}
