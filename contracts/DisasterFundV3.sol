// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

/// @notice Local-only valueless prototype. Signatures attest reviewer decisions, not objective truth.
/// @dev Fixed organizational registry v1; no upgrades, admin withdrawal or public-chain constructor.
contract DisasterFundV3 is ReentrancyGuard {
    using SafeERC20 for IERC20;
    IERC20 public immutable token;
    bytes32 public immutable DOMAIN;
    uint256 public constant CAP = 4500e6;
    uint256 public totalReserved;
    uint256 public totalPaid;
    uint256 public lastRoundAt;
    uint256 public roundNonce;
    address[3] public ngos;
    address[3] public dataReviewers;
    address[3] public evidenceReviewers;
    address[3] public appealReviewers;
    mapping(address => uint8) public ngoBit;
    mapping(address => uint8) public dataBit;
    mapping(address => uint8) public evidenceBit;
    mapping(address => uint8) public appealBit;
    mapping(bytes32 => uint256) public paidFor;
    mapping(bytes32 => uint256) public reservedFor;
    mapping(bytes32 => bool) public usedAssessment;
    mapping(address => mapping(uint256 => bool)) public usedNonce;
    mapping(bytes32 => bool) public usedRoundSnapshot;
    mapping(bytes32 => uint256) public openApplication;
    mapping(bytes32 => uint256) public lastRejected;

    struct Assessment {
        address ngo;
        bytes32 incident;
        uint256 areaVersion;
        bytes32 modelVersion;
        bytes32 sources;
        uint256 maximum;
        uint256 expires;
        uint256 nonce;
        uint256 deadlineDays;
    }

    struct Application {
        bytes32 key;
        bytes32 assessment;
        address ngo;
        uint256 requested;
        uint256 capacity;
        uint256 externalFunding;
        uint256 createdAt;
        uint8 eligibleMask;
        uint8 votes;
        bool followup;
        bool authorized;
        bool consumed;
    }

    struct Request {
        uint256 requested;
        uint256 capacity;
        uint256 externalFunding;
        uint8 conflicts;
        bool newEvidence;
    }

    struct Round {
        bytes32 snapshot;
        uint256 balance;
        uint256 reserved;
        uint256 nonce;
        uint256 validUntil;
        bool uncertain;
        bool competing;
        uint256 provisional;
    }

    struct Grant {
        uint256 application;
        uint256 amount;
    }

    struct Reservation {
        uint256 application;
        uint256 amount;
        uint256 expires;
        uint256 deadlineDays;
        bool settled;
    }

    // status 0=pending, 1=submitted/in review, 2=accepted, 3=requested, 4=rejected, 5=appeal, 6=resolved
    struct Evidence {
        address ngo;
        bytes32 key;
        uint256 amount;
        uint256 paidAt;
        uint256 due;
        uint256 responseDue;
        bytes32 manifest;
        uint8 status;
        bool extended;
        uint256 decisionAt;
        uint256 appealAt;
    }
    uint256 public applicationCount;
    uint256 public reservationCount;
    uint256 public evidenceCount;
    mapping(uint256 => Application) public applications;
    mapping(uint256 => Assessment) public assessments;
    mapping(uint256 => Reservation) public reservations;
    mapping(uint256 => Evidence) public evidence;
    mapping(address => uint256[]) private ngoEvidence;
    mapping(bytes32 => bool) public usedDecision;
    mapping(bytes32 => uint256) public roundHolds;
    mapping(bytes32 => uint256) public holdExpires;
    error Invalid();
    error Unauthorized();
    error Quorum();
    error Budget();
    error Expired();
    error Blocked();
    error Replay();
    event Deposited(address indexed donor, uint256 amount);
    event ApplicationOpened(uint256 indexed id, address indexed ngo, bytes32 indexed incident, bytes32 assessment);
    event FollowupVote(uint256 indexed id, address indexed voter);
    event RoundClosed(
        bytes32 indexed snapshot, uint256 indexed nonce, uint256 balance, uint256 committed, uint256 hold
    );
    event Reserved(uint256 indexed id, uint256 indexed application, uint256 amount, uint256 expires);
    event Paid(
        uint256 indexed evidenceId,
        address indexed ngo,
        bytes32 indexed incident,
        uint256 amount,
        uint256 reservationId,
        uint256 applicationId
    );
    event EvidenceChanged(uint256 indexed id, uint8 status, bytes32 manifest, uint256 due);
    event Released(uint256 indexed reservation, uint256 amount);

    constructor(IERC20 t, address[3] memory n, address[3] memory d, address[3] memory e, address[3] memory a) {
        if (block.chainid != 31337 || address(t).code.length == 0) revert Invalid();
        token = t;
        DOMAIN = keccak256(abi.encode(keccak256("DisasterDAO V3 local attestations v1"), block.chainid, address(this)));
        address[12] memory all;
        for (uint256 i; i < 3; i++) {
            all[i] = n[i];
            all[i + 3] = d[i];
            all[i + 6] = e[i];
            all[i + 9] = a[i];
        }
        for (uint256 i; i < 12; i++) {
            if (all[i] == address(0)) revert Invalid();
            for (uint256 j; j < i; j++) {
                if (all[i] == all[j]) revert Invalid();
            }
        }
        ngos = n;
        dataReviewers = d;
        evidenceReviewers = e;
        appealReviewers = a;
        for (uint8 i; i < 3; i++) {
            ngoBit[n[i]] = uint8(1 << i);
            dataBit[d[i]] = uint8(1 << i);
            evidenceBit[e[i]] = uint8(1 << i);
            appealBit[a[i]] = uint8(1 << i);
        }
    }

    function digest(bytes32 purpose, bytes32 payload) public view returns (bytes32) {
        return keccak256(abi.encodePacked("\x19\x01", DOMAIN, keccak256(abi.encode(purpose, payload))));
    }

    function assessmentHash(Assessment memory a) public pure returns (bytes32) {
        return keccak256(abi.encode(a));
    }

    function _quorum(bytes32 hash, bytes[] calldata sigs, uint8 group) private view {
        uint8 mask;
        for (uint256 i; i < sigs.length; i++) {
            address signer = ECDSA.recover(hash, sigs[i]);
            uint8 bit = group == 0 ? dataBit[signer] : group == 1 ? evidenceBit[signer] : appealBit[signer];
            if (bit == 0 || mask & bit != 0) revert Unauthorized();
            mask |= bit;
        }
        if (mask == 0 || mask & (mask - 1) == 0) revert Quorum();
    }

    function deposit(uint256 amount) external nonReentrant {
        if (amount == 0) revert Invalid();
        uint256 before_ = token.balanceOf(address(this));
        token.safeTransferFrom(msg.sender, address(this), amount);
        if (token.balanceOf(address(this)) - before_ != amount) revert Invalid();
        emit Deposited(msg.sender, amount);
    }

    function keyFor(address ngo, bytes32 incident) public pure returns (bytes32) {
        return keccak256(abi.encode(ngo, incident));
    }

    function open(Assessment calldata a, Request calldata r, bytes[] calldata sigs) external returns (uint256 id) {
        bytes32 ah = assessmentHash(a);
        bytes32 key = keyFor(a.ngo, a.incident);
        if (
            ngoBit[a.ngo] == 0 || msg.sender != a.ngo || a.incident == 0 || a.sources == 0 || a.modelVersion == 0
                || a.areaVersion == 0 || a.maximum == 0 || a.maximum > CAP || a.expires <= block.timestamp
                || r.requested == 0 || r.requested > a.maximum || r.capacity == 0 || r.capacity > a.maximum
        ) revert Invalid();
        if (a.deadlineDays != 30 && a.deadlineDays != 45 && a.deadlineDays != 60 && a.deadlineDays != 90) {
            revert Invalid();
        }
        if (openApplication[key] != 0 || usedAssessment[ah] || usedNonce[a.ngo][a.nonce]) revert Replay();
        if (reservedFor[key] > 0) revert Blocked();
        if (lastRejected[key] != 0 && block.timestamp < lastRejected[key] + 7 days && !r.newEvidence) revert Blocked();
        _quorum(digest(keccak256("APPLICATION"), keccak256(abi.encode(ah, r))), sigs, 0);
        if (isBlocked(a.ngo)) revert Blocked();
        usedAssessment[ah] = true;
        usedNonce[a.ngo][a.nonce] = true;
        id = ++applicationCount;
        Application storage app = applications[id];
        app.key = key;
        app.assessment = ah;
        app.ngo = a.ngo;
        app.requested = r.requested;
        app.capacity = r.capacity;
        app.externalFunding = r.externalFunding;
        app.createdAt = block.timestamp;
        app.eligibleMask = uint8(7) & ~ngoBit[a.ngo] & ~r.conflicts;
        app.followup = paidFor[key] > 0;
        app.authorized = !app.followup;
        assessments[id] = a;
        openApplication[key] = id;
        emit ApplicationOpened(id, a.ngo, a.incident, ah);
    }

    function vote(uint256 id) external {
        Application storage a = applications[id];
        uint8 bit = ngoBit[msg.sender];
        if (
            a.consumed || !a.followup || block.timestamp > a.createdAt + 72 hours || bit == 0
                || a.eligibleMask & bit == 0 || a.votes & bit != 0
        ) revert Unauthorized();
        a.votes |= bit;
        uint8 yes = _count(a.votes);
        uint8 eligible = _count(a.eligibleMask);
        if (yes >= 2 && uint256(yes) * 3 >= uint256(eligible) * 2) a.authorized = true;
        emit FollowupVote(id, msg.sender);
    }

    function authorizeFollowup(uint256 id, bytes[] calldata sigs) external {
        Application storage a = applications[id];
        if (a.consumed || !a.followup || block.timestamp > a.createdAt + 72 hours || !acceptedHistory(a.ngo)) {
            revert Blocked();
        }
        _quorum(digest(keccak256("FOLLOWUP"), keccak256(abi.encode(id, a.assessment))), sigs, 1);
        a.authorized = true;
    }

    function closeApplication(uint256 id) external {
        Application storage a = applications[id];
        if (a.consumed || a.ngo == address(0) || block.timestamp <= a.createdAt + 72 hours) revert Invalid();
        a.consumed = true;
        openApplication[a.key] = 0;
        lastRejected[a.key] = block.timestamp;
    }

    function _count(uint8 x) private pure returns (uint8 count) {
        while (x != 0) {
            count += x & 1;
            x >>= 1;
        }
    }

    function roundPayload(Grant[] calldata grants, Round calldata r) public pure returns (bytes32) {
        return keccak256(abi.encode(grants, r));
    }

    function closeRound(Grant[] calldata grants, Round calldata r, bytes[] calldata sigs) external nonReentrant {
        if (
            r.snapshot == 0 || usedRoundSnapshot[r.snapshot] || r.nonce != roundNonce || r.validUntil < block.timestamp
                || r.validUntil > block.timestamp + 1 hours || r.balance != token.balanceOf(address(this))
                || r.reserved != totalReserved || r.balance < r.reserved || grants.length > 32
        ) revert Invalid();
        if (lastRoundAt != 0 && block.timestamp < lastRoundAt + 6 hours) revert Blocked();
        _quorum(digest(keccak256("ROUND"), roundPayload(grants, r)), sigs, 0);
        uint256 free = r.balance - r.reserved;
        uint256 hold = r.uncertain ? free * 20 / 100 : 0;
        uint256 committed = r.provisional;
        for (uint256 i; i < grants.length; i++) {
            committed += _reserve(grants[i], r.uncertain || r.competing);
        }
        if (committed > free - hold) revert Budget();
        if (r.provisional > 0) {
            roundHolds[r.snapshot] = r.provisional;
            holdExpires[r.snapshot] = block.timestamp + 24 hours;
        }
        usedRoundSnapshot[r.snapshot] = true;
        totalReserved += committed;
        lastRoundAt = block.timestamp;
        roundNonce++;
        emit RoundClosed(r.snapshot, r.nonce, r.balance, committed, hold);
    }

    function _reserve(Grant calldata g, bool restricted) private returns (uint256) {
        Application storage app = applications[g.application];
        Assessment storage a = assessments[g.application];
        if (
            app.ngo == address(0) || app.consumed || !app.authorized || a.expires < block.timestamp || g.amount == 0
                || g.amount > app.requested || g.amount > app.capacity || isBlocked(a.ngo)
        ) revert Invalid();
        if (app.followup && block.timestamp > app.createdAt + 72 hours) revert Expired();
        uint256 ceiling = restricted ? a.maximum * 90 / 100 : a.maximum;
        if (paidFor[app.key] + reservedFor[app.key] + app.externalFunding + g.amount > ceiling) revert Budget();
        app.consumed = true;
        openApplication[app.key] = 0;
        reservedFor[app.key] += g.amount;
        uint256 id = ++reservationCount;
        reservations[id] = Reservation(g.application, g.amount, block.timestamp + 24 hours, a.deadlineDays, false);
        emit Reserved(id, g.application, g.amount, block.timestamp + 24 hours);
        return g.amount;
    }

    function releaseHold(bytes32 snapshot) external {
        if (block.timestamp <= holdExpires[snapshot] || roundHolds[snapshot] == 0) revert Invalid();
        totalReserved -= roundHolds[snapshot];
        roundHolds[snapshot] = 0;
    }

    function release(uint256 id) external {
        Reservation storage r = reservations[id];
        if (r.amount == 0 || r.settled || block.timestamp <= r.expires) revert Invalid();
        r.settled = true;
        Application storage a = applications[r.application];
        totalReserved -= r.amount;
        reservedFor[a.key] -= r.amount;
        emit Released(id, r.amount);
    }

    function claim(uint256 id) public nonReentrant {
        Reservation storage r = reservations[id];
        Application storage a = applications[r.application];
        if (r.amount == 0 || r.settled) revert Invalid();
        if (block.timestamp > r.expires) revert Expired();
        if (isBlocked(a.ngo)) revert Blocked();
        // Bounded demo history prevents gas growth beyond a known limit.
        if (ngoEvidence[a.ngo].length >= 64) revert Invalid();
        r.settled = true;
        totalReserved -= r.amount;
        reservedFor[a.key] -= r.amount;
        paidFor[a.key] += r.amount;
        totalPaid += r.amount;
        uint256 eid = ++evidenceCount;
        evidence[eid] = Evidence(
            a.ngo, a.key, r.amount, block.timestamp, block.timestamp + r.deadlineDays * 1 days, 0, 0, 0, false, 0, 0
        );
        ngoEvidence[a.ngo].push(eid);
        _afterClaim(r.application);
        token.safeTransfer(a.ngo, r.amount);
        emit Paid(eid, a.ngo, assessments[r.application].incident, r.amount, id, r.application);
    }

    function _afterClaim(uint256 application) internal virtual {}

    function isBlocked(address ngo) public view returns (bool) {
        uint256[] storage ids = ngoEvidence[ngo];
        for (uint256 i; i < ids.length; i++) {
            Evidence storage e = evidence[ids[i]];
            if (
                e.status == 4 || e.status == 5 || (e.status == 0 && block.timestamp > e.due)
                    || (e.status == 3 && block.timestamp > e.responseDue)
            ) return true;
        }
        return false;
    }

    function acceptedHistory(address ngo) public view returns (bool) {
        uint256[] storage ids = ngoEvidence[ngo];
        if (ids.length == 0) return false;
        for (uint256 i; i < ids.length; i++) {
            uint8 s = evidence[ids[i]].status;
            if (s != 2 && s != 6) return false;
        }
        return true;
    }

    function receipt(uint256 id, bytes32 manifest, uint256 receivedAt, bytes[] calldata sigs) external {
        Evidence storage e = evidence[id];
        if (
            e.ngo == address(0) || manifest == 0 || receivedAt < e.paidAt || receivedAt > block.timestamp
                || block.timestamp - receivedAt > 1 hours
        ) revert Invalid();
        if (e.status != 0 && e.status != 3) revert Invalid();
        uint256 due = e.status == 3 ? e.responseDue : e.due;
        if (receivedAt > due) revert Expired();
        _quorum(digest(keccak256("RECEIPT"), keccak256(abi.encode(id, manifest, receivedAt))), sigs, 1);
        e.manifest = manifest;
        e.status = 1;
        emit EvidenceChanged(id, 1, manifest, e.due);
    }

    function review(uint256 id, uint8 decision, bytes32 reason, bytes[] calldata sigs) external {
        Evidence storage e = evidence[id];
        if (e.ngo == address(0) || e.status != 1 || (decision != 2 && decision != 3 && decision != 4) || reason == 0) {
            revert Invalid();
        }
        bytes32 payload = keccak256(abi.encode(id, e.manifest, decision, reason));
        if (usedDecision[payload]) revert Replay();
        _quorum(digest(keccak256("REVIEW"), payload), sigs, 1);
        usedDecision[payload] = true;
        e.status = decision;
        e.decisionAt = block.timestamp;
        if (decision == 3) e.responseDue = block.timestamp + 14 days;
        emit EvidenceChanged(id, decision, e.manifest, e.due);
    }

    function extend(uint256 id, uint256 days_, bytes32 reason, bytes[] calldata sigs) external {
        Evidence storage e = evidence[id];
        if (
            e.ngo == address(0) || e.extended || e.status != 0 || block.timestamp > e.due || days_ == 0 || days_ > 30
                || reason == 0
        ) {
            revert Invalid();
        }
        _quorum(digest(keccak256("EXTEND"), keccak256(abi.encode(id, e.due, days_, reason))), sigs, 1);
        e.extended = true;
        e.due += days_ * 1 days;
        emit EvidenceChanged(id, e.status, e.manifest, e.due);
    }

    function appeal(uint256 id) external {
        Evidence storage e = evidence[id];
        if (msg.sender != e.ngo || e.status != 4 || block.timestamp > e.decisionAt + 14 days) revert Invalid();
        e.status = 5;
        e.appealAt = block.timestamp;
        emit EvidenceChanged(id, 5, e.manifest, e.due);
    }

    function resolve(uint256 id, bytes32 reason, bytes[] calldata sigs) external {
        Evidence storage e = evidence[id];
        if (e.ngo == address(0) || !isBlocked(e.ngo) || reason == 0) revert Invalid();
        _quorum(digest(keccak256("RESOLVE"), keccak256(abi.encode(id, e.manifest, e.status, e.due, reason))), sigs, 2);
        e.status = 6;
        emit EvidenceChanged(id, 6, e.manifest, e.due);
    }
}
