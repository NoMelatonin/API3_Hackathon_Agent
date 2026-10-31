// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {DisasterFundV3} from "./DisasterFundV3.sol";
import {AirnodeV2Attestation} from "./vendor/AirnodeV2Attestation.sol";
import {ProjectedJson} from "./vendor/ProjectedJson.sol";
import {SharedAllocation} from "./SharedAllocation.sol";

abstract contract OracleTypes {
    struct Policy {
        bytes32 incident;
        address airnode;
        bytes32 requestHash;
        bytes32 eventId;
        uint8 kind;
        bool synthetic;
        bool enabled;
        uint256 observedFrom;
        uint256 observedUntil;
    }
}

contract V3OracleVerifier is OracleTypes {
    error OracleInvalid();
    error OracleStale();
    error ObservationStale();
    error FundingRuleNotMet();

    function verify(Policy calldata p, uint256 timestamp, bytes calldata data, bytes calldata sig)
        external view returns (uint256 value)
    {
        if (!p.enabled) revert OracleInvalid();
        if (timestamp > block.timestamp || block.timestamp - timestamp > 5 minutes) revert OracleStale();
        AirnodeV2Attestation.verify(p.airnode, p.requestHash, timestamp, data, sig);
        if (keccak256(bytes(ProjectedJson.readString(data, "eventId"))) != p.eventId) revert OracleInvalid();
        int256 lat = ProjectedJson.readInt(data, "latitude", 6);
        int256 lon = ProjectedJson.readInt(data, "longitude", 6);
        uint256 slot = p.kind;
        uint256 observed;
        if (p.synthetic) {
            if (!ProjectedJson.readBool(data, "synthetic")) revert OracleInvalid();
            bytes32 unit = keccak256(bytes(ProjectedJson.readString(data, "unit")));
            if (unit != keccak256(bytes(slot == 0 ? "magnitude" : slot == 1 ? "kts" : "level"))) revert OracleInvalid();
            value = ProjectedJson.readUint(data, "severity", 2);
            observed = ProjectedJson.readUint(data, "observedAt", 0);
        } else if (slot == 0) {
            if (keccak256(bytes(ProjectedJson.readString(data, "eventType"))) != keccak256("earthquake")
                || keccak256(bytes(ProjectedJson.readString(data, "status"))) != keccak256("reviewed")) revert OracleInvalid();
            value = ProjectedJson.readUint(data, "magnitude", 2);
            observed = ProjectedJson.readUint(data, "eventTime", 0) / 1000;
        } else if (slot == 1) {
            if (keccak256(bytes(ProjectedJson.readString(data, "unit"))) != keccak256("kts")
                || keccak256(bytes(ProjectedJson.readString(data, "category"))) != keccak256("severeStorms")
                || keccak256(bytes(ProjectedJson.readString(data, "source"))) != keccak256("JTWC")
                || keccak256(bytes(ProjectedJson.readString(data, "geometryType"))) != keccak256("Point")) revert OracleInvalid();
            value = ProjectedJson.readUint(data, "windSpeed", 2);
            observed = ProjectedJson.readTimestamp(data, "observedAt");
        } else revert OracleInvalid();
        // Fresh signature and historical event time are independent constraints.
        if (observed > timestamp || (p.synthetic ? timestamp - observed > 1 days
            : observed < p.observedFrom || observed > p.observedUntil)) revert ObservationStale();
        if (slot == 0 ? (lat < 36e6 || lat > 39e6 || lon < 35e6 || lon > 39e6)
            : slot == 1 ? (p.synthetic ? (lat < 10e6 || lat > 18e6 || lon < 120e6 || lon > 125e6) : (lat < 26e6 || lat > 29e6 || lon < 160e6 || lon > 162e6))
            : (lat < -26e6 || lat > -11e6 || lon < 32e6 || lon > 40e6)) revert OracleInvalid();
        if (value < (slot == 0 ? 700 : slot == 1 ? 3400 : 200) || (slot >= 2 && value > 300)) revert FundingRuleNotMet();
    }
}

/// @notice One test-only shared fund. Both approval paths consume the same equal-weight package round.
contract DisasterFundV3Auto is DisasterFundV3, OracleTypes {
    V3OracleVerifier public immutable oracleVerifier;
    SharedAllocation public immutable allocator;
    address public immutable operator;
    uint256 public activatedAt;
    uint256 public immutable minimumFunding;
    error OracleBeforeActivation();

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
    mapping(bytes32 => uint256) public peak;
    mapping(uint256 => uint256) public applicationSeverity;
    mapping(uint256 => bool) public automaticApplication;
    mapping(bytes32 => uint256) public externalFor;
    mapping(uint256 => bytes32) public purposeHash;
    mapping(bytes32 => uint256) public submittedRequest;
    mapping(bytes32 => bytes32) private submittedContent;
    // Shared by BOTH paths: one immutable application -> at most one reservation.
    mapping(uint256 => uint256) public automaticReservation;
    uint256[12] public packageHolds;
    bytes32 public packageSnapshot;
    uint256 public packageExpires;
    bool public packageUncertain;
    bool public packageCompeting;
    uint256[4] public coverageUntil;
    event Activated(uint256 timestamp);
    event CoverageAttested(uint8 mask, bytes32 proof, uint256 expires);
    event OraclePurpose(uint256 indexed id, bytes32 purpose);
    event OracleApplication(uint256 indexed id, bytes32 proof, bool synthetic, bool authorized);

    constructor(IERC20 t, address[3] memory n, address[3] memory d, address[3] memory e,
        address[3] memory a, Policy[] memory p, uint256 seed) DisasterFundV3(t, n, d, e, a)
    {
        oracleVerifier = new V3OracleVerifier();
        allocator = new SharedAllocation();
        operator = msg.sender;
        require(seed > 0 && seed <= t.totalSupply(), "Funding target");
        minimumFunding = seed;
        require(p.length == 4, "Four fixed policies");
        for (uint256 i; i < p.length; i++) {
            require(p[i].kind == i && p[i].incident != 0 && p[i].airnode != address(0) && p[i].requestHash != 0, "Policy");
            require(block.chainid == 31337 || !p[i].synthetic, "No synthetic testnet policy");
            require(!p[i].enabled || p[i].synthetic || (p[i].observedFrom > 0 && p[i].observedUntil >= p[i].observedFrom), "Observation window");
            for (uint256 j; j < i; j++) require(p[i].incident != p[j].incident, "Duplicate incident");
            policies.push(p[i]);
        }
    }
    function activate() external {
        if (msg.sender != operator || activatedAt != 0 || token.balanceOf(address(this)) < minimumFunding) revert Invalid();
        activatedAt = block.timestamp;
        emit Activated(block.timestamp);
    }
    function _active() private view { if (activatedAt == 0) revert Blocked(); }
    function _verify(AutoRequest calldata r) private view returns (uint256) {
        _active();
        if (r.timestamp < activatedAt) revert OracleBeforeActivation();
        return oracleVerifier.verify(policies[r.slot], r.timestamp, r.data, r.signature);
    }
    function _slot(bytes32 incident) private view returns (uint256) {
        for (uint256 i; i < policies.length; i++) if (policies[i].incident == incident) return i;
        revert Invalid();
    }
    function _index(address ngo, uint256 slot) private view returns (uint256) {
        for (uint256 i; i < 3; i++) if (ngos[i] == ngo) return slot * 3 + i;
        revert Unauthorized();
    }
    function _authorized(uint256 id, uint256 severity) private view returns (bool) {
        Application storage app = applications[id];
        return app.authorized || paidFor[app.key] == 0 || acceptedHistory(app.ngo)
            || (automaticApplication[id] && peak[app.key] > 0 && severity >= peak[app.key]
                + (_slot(assessments[id].incident) == 0 ? 20 : _slot(assessments[id].incident) == 1 ? 500 : 100));
    }
    function automaticEligibility(AutoRequest calldata r) external view returns (bool authorized, uint256 severity) {
        if (r.slot >= policies.length || ngoBit[msg.sender] == 0) revert Unauthorized();
        severity = _verify(r);
        bytes32 key = keyFor(msg.sender, policies[r.slot].incident);
        authorized = paidFor[key] == 0 || acceptedHistory(msg.sender)
            || (peak[key] > 0 && severity >= peak[key] + (r.slot == 0 ? 20 : r.slot == 1 ? 500 : 100));
        uint256 id = openApplication[key];
        if (id > 0 && applications[id].authorized && block.timestamp <= applications[id].createdAt + 72 hours) authorized = true;
    }
    /// @notice Existing external coverage process, now also bound to the common contract policy.
    function attestCoverage(uint8 mask, bytes32 proof, uint256 expires, bytes[] calldata sigs) external {
        if (mask == 0 || mask > 15 || proof == 0 || expires <= block.timestamp || expires > block.timestamp + 1 hours) revert Invalid();
        _quorum(digest(keccak256("COVERAGE"), keccak256(abi.encode(mask, proof, expires))), sigs, 0);
        for (uint256 i; i < 4; i++) if (mask & uint8(1 << i) != 0) coverageUntil[i] = expires;
        emit CoverageAttested(mask, proof, expires);
    }
    function fundingUncertain() public view returns (bool) {
        for (uint256 i; i < 4; i++) if (coverageUntil[i] <= block.timestamp) return true;
        return false;
    }
    function effectiveReserved() public view returns (uint256) {
        return totalReserved - (block.timestamp > packageExpires ? roundHolds[packageSnapshot] : 0);
    }
    function releaseAutomaticHolds() public {
        if (block.timestamp <= packageExpires) return;
        totalReserved -= roundHolds[packageSnapshot];
        roundHolds[packageSnapshot] = 0;
        for (uint256 i; i < 12; i++) packageHolds[i] = 0;
    }
    function releaseHold(bytes32 snapshot) external override {
        if (snapshot != packageSnapshot || block.timestamp <= packageExpires || roundHolds[snapshot] == 0) revert Invalid();
        releaseAutomaticHolds();
    }
    function _liveRound() private view returns (bool) {
        return block.timestamp <= packageExpires && roundHolds[packageSnapshot] > 0;
    }
    function _limit(uint256 index, uint256 requested, uint256 capacity, uint256 externalFunding) private view returns (uint256) {
        address ngo = ngos[index % 3];
        bytes32 key = keyFor(ngo, policies[index / 3].incident);
        if (isBlocked(ngo) || reservedFor[key] > 0) return 0;
        uint256 spent = paidFor[key] + reservedFor[key] + externalFunding;
        // All twelve registered packages compete for this shared fund, including externally supported incidents.
        uint256 ceiling = CAP * 90 / 100;
        uint256 limit = spent >= ceiling ? 0 : ceiling - spent;
        if (limit > requested) limit = requested;
        if (limit > capacity) limit = capacity;
        return limit;
    }
    function _quote(uint256 target, uint256 requested, uint256 capacity, uint256 externalFunding)
        private view returns (uint256[] memory amounts, uint256 nextRound, bool uncertain, bool competing)
    {
        uncertain = _liveRound() ? packageUncertain : fundingUncertain();
        competing = true; // fixed registry: 3 NGOs x 4 incidents
        uint256[] memory limits = new uint256[](12);
        for (uint256 j; j < 12; j++) {
            bytes32 key = keyFor(ngos[j % 3], policies[j / 3].incident);
            uint256 id = openApplication[key];
            Application storage app = applications[id];
            limits[j] = _limit(j, j == target ? requested : id > 0 ? app.requested : CAP,
                j == target ? capacity : id > 0 ? app.capacity : CAP,
                j == target ? externalFunding : externalFor[key]);
            if (_liveRound() && limits[j] > packageHolds[j]) limits[j] = packageHolds[j];
        }
        if (_liveRound()) return (limits, 0, uncertain, competing);
        uint256 free = token.balanceOf(address(this)) - effectiveReserved();
        uint256 budget = uncertain ? free - free * 20 / 100 : free;
        amounts = allocator.allocate(budget, limits);
        nextRound = lastRoundAt == 0 ? 0 : lastRoundAt + 6 hours;
    }
    function sharedQuote() external view returns (uint256[] memory amounts, uint256 nextRound, bool uncertain, bool competing) {
        return _quote(type(uint256).max, 0, 0, 0);
    }
    function automaticQuote(uint256 slot, uint256 requested, uint256 capacity, uint256 externalFunding)
        public view returns (uint256 amount, uint256 provisional, uint256 nextRound)
    {
        if (slot >= policies.length || ngoBit[msg.sender] == 0) revert Unauthorized();
        uint256 target = _index(msg.sender, slot);
        (uint256[] memory amounts, uint256 next,,) = _quote(target, requested, capacity, externalFunding);
        for (uint256 i; i < 12; i++) if (i != target) provisional += amounts[i];
        return (amounts[target], provisional, _liveRound() && amounts[target] == 0 ? packageExpires + 1 : next);
    }
    function _startRound() private {
        releaseAutomaticHolds();
        if (_liveRound()) return;
        (uint256[] memory amounts, uint256 next, bool uncertain, bool competing) = _quote(type(uint256).max, 0, 0, 0);
        if (block.timestamp < next) revert Blocked();
        uint256 committed;
        for (uint256 i; i < 12; i++) { packageHolds[i] = amounts[i]; committed += amounts[i]; }
        if (committed == 0) revert Budget();
        packageSnapshot = keccak256(abi.encode(address(this), roundNonce, block.timestamp));
        packageExpires = block.timestamp + 24 hours;
        packageUncertain = uncertain;
        packageCompeting = competing;
        roundHolds[packageSnapshot] = committed;
        holdExpires[packageSnapshot] = packageExpires;
        totalReserved += committed;
        lastRoundAt = block.timestamp;
        uint256 balance = token.balanceOf(address(this));
        emit RoundClosed(packageSnapshot, roundNonce++, balance, committed,
            uncertain ? (balance - totalReserved + committed) * 20 / 100 : 0);
    }
    function _reserveShared(uint256 id) private returns (uint256 rid) {
        Application storage app = applications[id];
        if (app.consumed || isBlocked(app.ngo) || assessments[id].expires < block.timestamp || block.timestamp > app.createdAt + 72 hours) revert Blocked();
        _startRound();
        uint256 index = _index(app.ngo, _slot(assessments[id].incident));
        uint256 amount = _limit(index, app.requested, app.capacity, app.externalFunding);
        if (amount > packageHolds[index]) amount = packageHolds[index];
        if (amount == 0) revert Budget();
        packageHolds[index] -= amount;
        roundHolds[packageSnapshot] -= amount;
        app.consumed = true;
        openApplication[app.key] = 0;
        reservedFor[app.key] += amount;
        rid = ++reservationCount;
        automaticReservation[id] = rid;
        reservations[rid] = Reservation(id, amount, block.timestamp + 24 hours, assessments[id].deadlineDays, false);
        emit Reserved(rid, id, amount, block.timestamp + 24 hours);
    }
    function open(Assessment calldata a, Request calldata r, bytes[] calldata sigs) public override returns (uint256 id) {
        _active();
        uint256 slot = _slot(a.incident);
        if (a.maximum != CAP || a.modelVersion != keccak256("fixed-equal-package-policy-v1")
            || a.deadlineDays != (slot == 3 ? 45 : 30)) revert Invalid();
        id = super.open(a, r, sigs);
        externalFor[applications[id].key] = r.externalFunding;
        applications[id].authorized = !applications[id].followup || acceptedHistory(a.ngo);
    }
    function closeRound(Grant[] calldata grants, Round calldata r, bytes[] calldata sigs) external override nonReentrant {
        _active();
        if (r.snapshot == 0 || usedRoundSnapshot[r.snapshot] || r.nonce != roundNonce || r.validUntil < block.timestamp
            || r.validUntil > block.timestamp + 1 hours || r.balance != token.balanceOf(address(this))
            || r.reserved != effectiveReserved() || grants.length == 0 || grants.length > 12) revert Invalid();
        _quorum(digest(keccak256("ROUND"), roundPayload(grants, r)), sigs, 0);
        (uint256[] memory amounts,, bool uncertain, bool competing) = _quote(type(uint256).max, 0, 0, 0);
        if (r.uncertain != uncertain || r.competing != competing) revert Invalid();
        uint256 sum;
        for (uint256 i; i < 12; i++) sum += amounts[i];
        for (uint256 i; i < grants.length; i++) {
            uint256 id = grants[i].application;
            Application storage app = applications[id];
            if (app.ngo == address(0) || automaticApplication[id] || !_authorized(id, 0)) revert Unauthorized();
            uint256 index = _index(app.ngo, _slot(assessments[id].incident));
            if (grants[i].amount == 0 || grants[i].amount != amounts[index]) revert Budget();
            amounts[index] = 0; // duplicate application/package cannot consume twice
            sum -= grants[i].amount;
        }
        if (r.provisional != sum) revert Invalid();
        usedRoundSnapshot[r.snapshot] = true;
        for (uint256 i; i < grants.length; i++) {
            uint256 rid = _reserveShared(grants[i].application);
            if (reservations[rid].amount != grants[i].amount) revert Budget();
        }
    }
    function automaticSubmit(AutoRequest calldata r, bytes32 purpose, bytes32 requestId) external returns (uint256 id) {
        if (r.slot >= policies.length || ngoBit[msg.sender] == 0) revert Unauthorized();
        if (purpose == 0 || requestId == 0 || r.requested == 0 || r.requested > CAP || r.capacity == 0 || r.capacity > CAP) revert Invalid();
        bytes32 retry = keccak256(abi.encode(msg.sender, requestId));
        bytes32 content = keccak256(abi.encode(r.slot, r.requested, r.capacity, r.externalFunding, purpose));
        id = submittedRequest[retry];
        if (id != 0) { if (submittedContent[retry] != content) revert Invalid(); return id; }
        if (isBlocked(msg.sender)) revert Blocked();
        uint256 severity = _verify(r);
        bytes32 key = keyFor(msg.sender, policies[r.slot].incident);
        if (reservedFor[key] > 0 || openApplication[key] != 0) revert Blocked();
        if (lastRejected[key] != 0 && block.timestamp < lastRejected[key] + 7 days) revert Blocked();
        id = ++applicationCount;
        bytes32 proof = keccak256(abi.encode(r.timestamp, r.data, r.signature));
        assessments[id] = Assessment(msg.sender, policies[r.slot].incident, 1,
            keccak256("fixed-equal-package-policy-v1"), proof, CAP, block.timestamp + 7 days, id, r.slot == 3 ? 45 : 30);
        applications[id] = Application(key, assessmentHash(assessments[id]), msg.sender,
            r.requested, r.capacity, r.externalFunding, block.timestamp,
            uint8(7) & ~ngoBit[msg.sender], 0, paidFor[key] > 0, false, false);
        openApplication[key] = id;
        externalFor[key] = r.externalFunding;
        automaticApplication[id] = true;
        applicationSeverity[id] = severity;
        purposeHash[id] = purpose;
        submittedRequest[retry] = id;
        submittedContent[retry] = content;
        emit ApplicationOpened(id, msg.sender, policies[r.slot].incident, applications[id].assessment);
        emit OracleApplication(id, proof, policies[r.slot].synthetic, false);
        emit OraclePurpose(id, purpose);
    }
    function automaticReserve(uint256 id, AutoRequest calldata r) external returns (uint256 rid) {
        Application storage app = applications[id];
        if (app.ngo != msg.sender || !automaticApplication[id] || r.slot >= policies.length) revert Unauthorized();
        if (app.requested != r.requested || app.capacity != r.capacity || app.externalFunding != r.externalFunding
            || assessments[id].incident != policies[r.slot].incident) revert Invalid();
        rid = automaticReservation[id];
        if (rid != 0) return rid;
        uint256 severity = _verify(r);
        if (!_authorized(id, severity)) revert Unauthorized();
        applicationSeverity[id] = severity;
        rid = _reserveShared(id);
        emit OracleApplication(id, keccak256(abi.encode(r.timestamp, r.data, r.signature)), policies[r.slot].synthetic, true);
    }
    function _afterClaim(uint256 id) internal override {
        bytes32 key = applications[id].key;
        if (automaticApplication[id] && applicationSeverity[id] > peak[key]) peak[key] = applicationSeverity[id];
    }
}
