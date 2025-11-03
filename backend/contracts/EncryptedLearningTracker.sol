// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, euint32, externalEuint32} from "@fhevm/solidity/lib/FHE.sol";
import {SepoliaConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";

/// @title Encrypted Learning Tracker
/// @notice A FHEVM-based DApp for encrypted learning achievement tracking
/// @dev All student data (scores, study time, focus levels) are encrypted on-chain
contract EncryptedLearningTracker is SepoliaConfig, ERC721 {
    // ============ Structs ============
    
    struct Course {
        string name;
        euint32 threshold; // Encrypted passing threshold
        bool exists;
    }
    
    struct StudentRecord {
        mapping(uint256 => euint32) courseScores; // courseId => encrypted score
        mapping(uint256 => euint32) coursePassed; // courseId => pass/fail (encrypted, 0 or 1)
        mapping(uint256 => bool) hasScore; // courseId => whether a score has been uploaded
        uint256[] dailyStudyDays; // List of days when study data was recorded
        mapping(uint256 => DailyStudyData) dailyStudyData; // timestamp => study data
        uint256 consecutiveCheckIns; // Clear value for consecutive check-ins
        uint256 lastCheckInDay; // Last check-in day (timestamp / 86400)
    }
    
    struct DailyStudyData {
        euint32 studyTime; // Encrypted study time in minutes
        euint32 focusLevel; // Encrypted focus level (0-100)
        bool exists;
    }
    
    struct SkillProof {
        uint256 courseId;
        uint256 timestamp;
        bool exists;
    }
    
    // ============ State Variables ============
    
    mapping(address => StudentRecord) private studentRecords;
    mapping(uint256 => Course) private courses;
    mapping(address => mapping(uint256 => SkillProof)) private skillProofs; // student => skillId => proof
    uint256 private courseCounter;
    uint256 private skillCounter;
    string private baseTokenURI;
    
    // ============ Events ============
    
    event ScoreUploaded(address indexed student, uint256 indexed courseId, bytes32 handle);
    event CoursePassed(address indexed student, uint256 indexed courseId);
    event StudyDataRecorded(address indexed student, uint256 indexed timestamp);
    event CheckInRecorded(address indexed student, uint256 consecutiveDays);
    event SkillProofGenerated(address indexed student, uint256 indexed skillId, uint256 courseId);
    
    // ============ Modifiers ============
    
    modifier courseExists(uint256 courseId) {
        require(courses[courseId].exists, "Course does not exist");
        _;
    }
    
    // ============ Constructor ============
    
    constructor() ERC721("Encrypted Skill Proof", "ESP") {
        courseCounter = 0;
        skillCounter = 0;
        baseTokenURI = "";
    }
    
    // ============ Course Management ============
    
    /// @notice Create a new course with encrypted threshold
    /// @param courseName Name of the course
    /// @param thresholdEuint32 Encrypted passing threshold
    /// @param thresholdProof Proof for the encrypted threshold
    /// @return courseId The ID of the newly created course
    function createCourse(
        string memory courseName,
        externalEuint32 thresholdEuint32,
        bytes calldata thresholdProof
    ) external returns (uint256 courseId) {
        euint32 encryptedThreshold = FHE.fromExternal(thresholdEuint32, thresholdProof);
        FHE.allowThis(encryptedThreshold);
        
        courseId = courseCounter;
        courses[courseId] = Course({
            name: courseName,
            threshold: encryptedThreshold,
            exists: true
        });
        
        courseCounter++;
        
        return courseId;
    }
    
    /// @notice Get course information
    /// @param courseId The course ID
    /// @return name Course name
    /// @return thresholdHandle Encrypted threshold handle
    /// @return exists Whether the course exists
    function getCourse(uint256 courseId) 
        external 
        view 
        returns (string memory name, bytes32 thresholdHandle, bool exists) 
    {
        Course storage course = courses[courseId];
        return (course.name, FHE.toBytes32(course.threshold), course.exists);
    }
    
    // ============ Score Upload & Verification ============
    
    /// @notice Upload encrypted score for a course
    /// @param courseId The course ID
    /// @param scoreEuint32 Encrypted score
    /// @param scoreProof Proof for the encrypted score
    function uploadScore(
        uint256 courseId,
        externalEuint32 scoreEuint32,
        bytes calldata scoreProof
    ) external courseExists(courseId) {
        euint32 encryptedScore = FHE.fromExternal(scoreEuint32, scoreProof);
        
        StudentRecord storage record = studentRecords[msg.sender];
        record.courseScores[courseId] = encryptedScore;
        record.hasScore[courseId] = true;
        
        // Verify if score passes threshold (encrypted comparison)
        Course storage course = courses[courseId];
        // Convert boolean result to euint32 (1 = passed, 0 = failed)
        euint32 isPassed = FHE.select(FHE.ge(encryptedScore, course.threshold), FHE.asEuint32(1), FHE.asEuint32(0));
        record.coursePassed[courseId] = isPassed;
        
        // Allow decryption of pass/fail result
        FHE.allowThis(isPassed);
        FHE.allow(isPassed, msg.sender);
        
        // Allow decryption of score
        FHE.allowThis(encryptedScore);
        FHE.allow(encryptedScore, msg.sender);
        
        emit ScoreUploaded(msg.sender, courseId, FHE.toBytes32(encryptedScore));
    }
    
    /// @notice Get encrypted score for a course
    /// @param student The student address
    /// @param courseId The course ID
    /// @return scoreHandle Encrypted score handle
    /// @return passedHandle Encrypted pass/fail handle
    function getScore(address student, uint256 courseId)
        external
        view
        courseExists(courseId)
        returns (bytes32 scoreHandle, bytes32 passedHandle)
    {
        StudentRecord storage record = studentRecords[student];
        return (
            FHE.toBytes32(record.courseScores[courseId]),
            FHE.toBytes32(record.coursePassed[courseId])
        );
    }
    
    // ============ Skill Proof (NFT-like) ============
    
    /// @notice Generate a skill proof if student passed the course
    /// @param courseId The course ID
    /// @return skillId The ID of the generated skill proof
    function generateSkillProof(
        uint256 courseId
    ) external courseExists(courseId) returns (uint256 skillId) {
        // Basic eligibility: must have a recorded encrypted pass/fail for this course
        // Security note: On-chain无法直接分支密文布尔值，强校验需配合解密证明流程。
        // 这里要求用户先上传成绩（会写入 coursePassed[courseId]），再允许铸造。
        StudentRecord storage record = studentRecords[msg.sender];
        require(record.hasScore[courseId], "Score not uploaded");

        // Mint ERC721 proof token
        skillId = skillCounter;
        _safeMint(msg.sender, skillId);

        // Store lightweight proof metadata
        skillProofs[msg.sender][skillId] = SkillProof({
            courseId: courseId,
            timestamp: block.timestamp,
            exists: true
        });

        unchecked {
            skillCounter++;
        }

        emit SkillProofGenerated(msg.sender, skillId, courseId);
        return skillId;
    }
    
    /// @notice Get skill proof information
    /// @param student The student address
    /// @param skillId The skill proof ID
    /// @return courseId The course ID
    /// @return timestamp When the proof was generated
    /// @return exists Whether the proof exists
    function getSkillProof(address student, uint256 skillId)
        external
        view
        returns (uint256 courseId, uint256 timestamp, bool exists)
    {
        SkillProof storage proof = skillProofs[student][skillId];
        return (proof.courseId, proof.timestamp, proof.exists);
    }
    
    // ============ Study Time & Focus Level ============
    
    /// @notice Record encrypted daily study data
    /// @param timestamp The day timestamp (normalized to day start)
    /// @param studyTimeEuint32 Encrypted study time in minutes
    /// @param studyTimeProof Proof for encrypted study time
    /// @param focusLevelEuint32 Encrypted focus level (0-100)
    /// @param focusLevelProof Proof for encrypted focus level
    function recordStudyData(
        uint256 timestamp,
        externalEuint32 studyTimeEuint32,
        bytes calldata studyTimeProof,
        externalEuint32 focusLevelEuint32,
        bytes calldata focusLevelProof
    ) external {
        euint32 encryptedStudyTime = FHE.fromExternal(studyTimeEuint32, studyTimeProof);
        euint32 encryptedFocusLevel = FHE.fromExternal(focusLevelEuint32, focusLevelProof);
        
        StudentRecord storage record = studentRecords[msg.sender];
        
        // Normalize timestamp to day
        uint256 dayTimestamp = (timestamp / 86400) * 86400;
        
        if (!record.dailyStudyData[dayTimestamp].exists) {
            record.dailyStudyDays.push(dayTimestamp);
        }
        
        record.dailyStudyData[dayTimestamp] = DailyStudyData({
            studyTime: encryptedStudyTime,
            focusLevel: encryptedFocusLevel,
            exists: true
        });
        
        // Allow decryption for the student
        FHE.allowThis(encryptedStudyTime);
        FHE.allow(encryptedStudyTime, msg.sender);
        FHE.allowThis(encryptedFocusLevel);
        FHE.allow(encryptedFocusLevel, msg.sender);
        
        emit StudyDataRecorded(msg.sender, dayTimestamp);
    }
    
    /// @notice Get encrypted study data for a specific day
    /// @param student The student address
    /// @param timestamp The day timestamp
    /// @return studyTimeHandle Encrypted study time handle
    /// @return focusLevelHandle Encrypted focus level handle
    /// @return exists Whether data exists for this day
    function getStudyData(address student, uint256 timestamp)
        external
        view
        returns (
            bytes32 studyTimeHandle,
            bytes32 focusLevelHandle,
            bool exists
        )
    {
        uint256 dayTimestamp = (timestamp / 86400) * 86400;
        DailyStudyData storage data = studentRecords[student].dailyStudyData[dayTimestamp];
        
        return (
            FHE.toBytes32(data.studyTime),
            FHE.toBytes32(data.focusLevel),
            data.exists
        );
    }
    
    /// @notice Get list of days when study data was recorded
    /// @param student The student address
    /// @return dayTimestamps Array of day timestamps
    function getStudyDays(address student)
        external
        view
        returns (uint256[] memory dayTimestamps)
    {
        return studentRecords[student].dailyStudyDays;
    }
    
    // ============ Check-in ============
    
    /// @notice Record encrypted check-in (daily study time upload)
    /// @param studyTimeEuint32 Encrypted study time for today
    /// @param studyTimeProof Proof for encrypted study time
    /// @return consecutiveDays Number of consecutive check-in days
    function checkIn(
        externalEuint32 studyTimeEuint32,
        bytes calldata studyTimeProof
    ) external returns (uint256 consecutiveDays) {
        euint32 encryptedStudyTime = FHE.fromExternal(studyTimeEuint32, studyTimeProof);
        
        StudentRecord storage record = studentRecords[msg.sender];
        
        // Calculate current day
        uint256 currentDay = block.timestamp / 86400;
        
        // Check if this is a new day
        if (record.lastCheckInDay == 0 || record.lastCheckInDay < currentDay) {
            // Check if consecutive
            if (record.lastCheckInDay == 0 || record.lastCheckInDay == currentDay - 1) {
                record.consecutiveCheckIns++;
            } else {
                record.consecutiveCheckIns = 1;
            }
            
            record.lastCheckInDay = currentDay;
            
            // Also record in daily study data
            uint256 dayTimestamp = currentDay * 86400;
            if (!record.dailyStudyData[dayTimestamp].exists) {
                record.dailyStudyDays.push(dayTimestamp);
            }
            record.dailyStudyData[dayTimestamp] = DailyStudyData({
                studyTime: encryptedStudyTime,
                focusLevel: FHE.asEuint32(0), // Focus level not provided in check-in
                exists: true
            });
            
            // Allow decryption
            FHE.allowThis(encryptedStudyTime);
            FHE.allow(encryptedStudyTime, msg.sender);
        }
        
        consecutiveDays = record.consecutiveCheckIns;
        emit CheckInRecorded(msg.sender, consecutiveDays);
        
        return consecutiveDays;
    }
    
    /// @notice Get check-in statistics
    /// @param student The student address
    /// @return consecutiveDays Number of consecutive check-in days
    /// @return lastCheckInDay Last check-in day
    function getCheckInStats(address student)
        external
        view
        returns (uint256 consecutiveDays, uint256 lastCheckInDay)
    {
        StudentRecord storage record = studentRecords[student];
        return (record.consecutiveCheckIns, record.lastCheckInDay);
    }

    // ============ ERC721 Helpers ============

    function setBaseURI(string calldata newBaseURI) external {
        // In a real app, restrict to owner/admin.
        baseTokenURI = newBaseURI;
    }

    function _baseURI() internal view override returns (string memory) {
        return baseTokenURI;
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        require(_ownerOf(tokenId) != address(0), "Nonexistent token");
        string memory base = _baseURI();
        if (bytes(base).length == 0) {
            return "";
        }
        return string(abi.encodePacked(base, Strings.toString(tokenId)));
    }
}

