"use client";

import { useFhevm } from "../fhevm/useFhevm";
import { useInMemoryStorage } from "../hooks/useInMemoryStorage";
import { useMetaMaskEthersSigner } from "../hooks/metamask/useMetaMaskEthersSigner";
import { errorNotDeployed } from "./ErrorNotDeployed";
import { ethers } from "ethers";
import { useState, useCallback, useEffect, useMemo } from "react";
import { FhevmInstance } from "@/fhevm/fhevmTypes";
import { FhevmDecryptionSignature } from "@/fhevm/FhevmDecryptionSignature";
import { EncryptedLearningTrackerAddresses } from "@/abi/EncryptedLearningTrackerAddresses";
import { EncryptedLearningTrackerABI } from "@/abi/EncryptedLearningTrackerABI";

function getContractByChainId(chainId: number | undefined) {
  if (!chainId) {
    return { abi: EncryptedLearningTrackerABI.abi };
  }

  const entry = EncryptedLearningTrackerAddresses[chainId.toString() as keyof typeof EncryptedLearningTrackerAddresses];

  if (!("address" in entry) || entry.address === ethers.ZeroAddress) {
    return { abi: EncryptedLearningTrackerABI.abi, chainId };
  }

  return {
    address: entry?.address as `0x${string}` | undefined,
    chainId: entry?.chainId ?? chainId,
    chainName: entry?.chainName,
    abi: EncryptedLearningTrackerABI.abi,
  };
}

type TabType = "courses" | "scores" | "study";

export const LearningTrackerDemo = () => {
  const { storage: fhevmDecryptionSignatureStorage } = useInMemoryStorage();
  const {
    provider,
    chainId,
    accounts,
    isConnected,
    connect,
    ethersSigner,
    ethersReadonlyProvider,
    sameChain,
    sameSigner,
    initialMockChains,
  } = useMetaMaskEthersSigner();

  const {
    instance: fhevmInstance,
    status: fhevmStatus,
    error: fhevmError,
  } = useFhevm({
    provider,
    chainId,
    initialMockChains,
    enabled: true,
  });

  const [activeTab, setActiveTab] = useState<TabType>("courses");
  const [courseName, setCourseName] = useState("");
  const [courseThreshold, setCourseThreshold] = useState(60);
  const [selectedCourseId, setSelectedCourseId] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [studyTime, setStudyTime] = useState(0);
  const [focusLevel, setFocusLevel] = useState(0);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error" | "info">("info");
  const [isLoading, setIsLoading] = useState(false);
  const [proofCourseId, setProofCourseId] = useState<number | null>(null);
  const [querySkillId, setQuerySkillId] = useState<number | null>(null);
  const [skillInfo, setSkillInfo] = useState<{
    skillId?: number;
    courseId?: number;
    timestamp?: number;
    passed?: boolean;
  } | null>(null);
  const [searchCourseId, setSearchCourseId] = useState<number | null>(null);
  const [searchedCourse, setSearchedCourse] = useState<{
    name: string;
    thresholdHandle: string;
    exists: boolean;
  } | null>(null);

  const contractInfo = useMemo(() => getContractByChainId(chainId), [chainId]);
  const isDeployed = useMemo(() => {
    return Boolean(contractInfo.address && contractInfo.address !== ethers.ZeroAddress);
  }, [contractInfo]);

  const showMessage = (msg: string, type: "success" | "error" | "info" = "info") => {
    setMessage(msg);
    setMessageType(type);
  };

  const createCourse = useCallback(async () => {
    if (!fhevmInstance || !ethersSigner || !contractInfo.address || !courseName) return;

    setIsLoading(true);
    showMessage("🔐 Encrypting course data and submitting to blockchain...", "info");

    try {
      const user = await ethersSigner.getAddress();
      const input = fhevmInstance.createEncryptedInput(contractInfo.address, user);
      input.add32(courseThreshold);
      const enc = await input.encrypt();

      const contract = new ethers.Contract(
        contractInfo.address,
        contractInfo.abi,
        ethersSigner
      );

      const tx = await contract.createCourse(courseName, enc.handles[0], enc.inputProof);
      await tx.wait();

      showMessage(`✅ Course "${courseName}" created successfully with encrypted threshold!`, "success");
      setCourseName("");
      setCourseThreshold(60);
    } catch (error: any) {
      showMessage(`❌ Failed to create course: ${error.message}`, "error");
    } finally {
      setIsLoading(false);
    }
  }, [fhevmInstance, ethersSigner, contractInfo, courseName, courseThreshold]);

  const uploadScore = useCallback(async () => {
    if (!fhevmInstance || !ethersSigner || !contractInfo.address || selectedCourseId === null) return;

    setIsLoading(true);
    showMessage("🔒 Encrypting your score and uploading securely...", "info");

    try {
      const user = await ethersSigner.getAddress();
      const input = fhevmInstance.createEncryptedInput(contractInfo.address, user);
      input.add32(score);
      const enc = await input.encrypt();

      const contract = new ethers.Contract(
        contractInfo.address,
        contractInfo.abi,
        ethersSigner
      );

      const tx = await contract.uploadScore(selectedCourseId, enc.handles[0], enc.inputProof);
      await tx.wait();

      showMessage(`✅ Score uploaded successfully! Smart contract is verifying your performance...`, "success");
      setScore(0);
    } catch (error: any) {
      showMessage(`❌ Score upload failed: ${error.message}`, "error");
    } finally {
      setIsLoading(false);
    }
  }, [fhevmInstance, ethersSigner, contractInfo, selectedCourseId, score]);

  const checkIn = useCallback(async () => {
    if (!fhevmInstance || !ethersSigner || !contractInfo.address) return;

    setIsLoading(true);
    showMessage("📝 Recording your encrypted check-in...", "info");

    try {
      const user = await ethersSigner.getAddress();
      const input = fhevmInstance.createEncryptedInput(contractInfo.address, user);
      input.add32(studyTime);
      const enc = await input.encrypt();

      const contract = new ethers.Contract(
        contractInfo.address,
        contractInfo.abi,
        ethersSigner
      );

      const tx = await contract.checkIn(enc.handles[0], enc.inputProof);
      const receipt = await tx.wait();

      showMessage(`✅ Daily check-in recorded! Your learning streak continues!`, "success");
      setStudyTime(0);
    } catch (error: any) {
      showMessage(`❌ Check-in failed: ${error.message}`, "error");
    } finally {
      setIsLoading(false);
    }
  }, [fhevmInstance, ethersSigner, contractInfo, studyTime]);

  const generateSkillProof = useCallback(async () => {
    if (!ethersSigner || !contractInfo.address || proofCourseId === null) return;

    setIsLoading(true);
    showMessage("🎓 Generating your encrypted skill proof NFT...", "info");

    try {
      const contract = new ethers.Contract(
        contractInfo.address,
        contractInfo.abi,
        ethersSigner
      );

      const tx = await contract.generateSkillProof(proofCourseId);
      const receipt = await tx.wait();

      showMessage(`✅ Skill proof NFT minted! Transaction: ${receipt?.hash ?? "completed"}`, "success");
    } catch (error: any) {
      showMessage(`❌ Failed to generate skill proof: ${error.message}`, "error");
    } finally {
      setIsLoading(false);
    }
  }, [ethersSigner, contractInfo, proofCourseId]);

  const getSkillProofInfo = useCallback(async () => {
    if (!ethersSigner || !contractInfo.address || querySkillId === null) return;

    setIsLoading(true);
    showMessage("🔍 Fetching skill proof information...", "info");

    try {
      const addr = await ethersSigner.getAddress();
      const contract = new ethers.Contract(
        contractInfo.address,
        contractInfo.abi,
        ethersSigner
      );
      const [courseId, timestamp, exists] = await contract.getSkillProof(addr, querySkillId);
      if (!exists) {
        showMessage("⚠️ Skill proof not found", "error");
        setSkillInfo(null);
      } else {
        const baseInfo = { skillId: querySkillId, courseId: Number(courseId), timestamp: Number(timestamp) };

        let passedBool: boolean | undefined = undefined;
        try {
          if (fhevmInstance) {
            const [/*scoreHandle*/, passedHandle] = await contract.getScore(addr, Number(courseId));

            const sig = await FhevmDecryptionSignature.loadOrSign(
              fhevmInstance,
              [contractInfo.address],
              ethersSigner,
              fhevmDecryptionSignatureStorage
            );

            if (sig) {
              const results = await fhevmInstance.userDecrypt(
                [
                  {
                    handle: passedHandle,
                    contractAddress: contractInfo.address,
                  },
                ],
                sig.privateKey,
                sig.publicKey,
                sig.signature,
                sig.contractAddresses,
                sig.userAddress,
                sig.startTimestamp,
                sig.durationDays
              );

              const firstValue = Object.values(results)[0];
              if (typeof firstValue === "boolean") {
                passedBool = firstValue;
              } else if (typeof firstValue === "bigint") {
                passedBool = firstValue === 1n;
              } else if (typeof firstValue === "string") {
                const fv = firstValue as string;
                passedBool = fv === "1" || fv.toLowerCase() === "true";
              }
            }
          }
        } catch (e) {
          console.warn("Decrypt passedHandle failed", e);
        }

        showMessage("✅ Skill proof information loaded", "success");
        setSkillInfo({ ...baseInfo, passed: passedBool });
      }
    } catch (error: any) {
      showMessage(`❌ Failed to fetch skill proof: ${error.message}`, "error");
      setSkillInfo(null);
    } finally {
      setIsLoading(false);
    }
  }, [ethersSigner, contractInfo, querySkillId, fhevmInstance, fhevmDecryptionSignatureStorage]);

  const recordStudyData = useCallback(async () => {
    if (!fhevmInstance || !ethersSigner || !contractInfo.address) return;

    setIsLoading(true);
    showMessage("📊 Recording encrypted study data...", "info");

    try {
      const timestamp = Math.floor(Date.now() / 1000);
      
      const user = await ethersSigner.getAddress();
      const input1 = fhevmInstance.createEncryptedInput(contractInfo.address, user);
      input1.add32(studyTime);
      const enc1 = await input1.encrypt();

      const input2 = fhevmInstance.createEncryptedInput(contractInfo.address, user);
      input2.add32(focusLevel);
      const enc2 = await input2.encrypt();

      const contract = new ethers.Contract(
        contractInfo.address,
        contractInfo.abi,
        ethersSigner
      );

      const tx = await contract.recordStudyData(
        timestamp,
        enc1.handles[0],
        enc1.inputProof,
        enc2.handles[0],
        enc2.inputProof
      );
      await tx.wait();

      showMessage(`✅ Study data recorded! Your learning progress is tracked privately.`, "success");
      setStudyTime(0);
      setFocusLevel(0);
    } catch (error: any) {
      showMessage(`❌ Failed to record study data: ${error.message}`, "error");
    } finally {
      setIsLoading(false);
    }
  }, [fhevmInstance, ethersSigner, contractInfo, studyTime, focusLevel]);

  const searchCourse = useCallback(async () => {
    if (!ethersSigner || !contractInfo.address || searchCourseId === null) return;

    setIsLoading(true);
    showMessage("🔍 Searching for course...", "info");

    try {
      const contract = new ethers.Contract(
        contractInfo.address,
        contractInfo.abi,
        ethersSigner
      );
      const result = await contract.getCourse(searchCourseId);
      const name: string = result[0];
      const thresholdHandle: string = result[1];
      const exists: boolean = result[2];
      setSearchedCourse({ name, thresholdHandle, exists });
      showMessage(exists ? `✅ Course found: ${name}` : "⚠️ Course not found", exists ? "success" : "error");
    } catch (error: any) {
      showMessage(`❌ Search failed: ${error.message}`, "error");
      setSearchedCourse(null);
    } finally {
      setIsLoading(false);
    }
  }, [ethersSigner, contractInfo, searchCourseId]);

  if (!isConnected) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="section-card max-w-md w-full text-center animate-pulse-glow">
          <div className="mb-6">
            <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-[var(--primary-blue)] to-[var(--primary-gold)] flex items-center justify-center glow-effect">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-10 h-10 text-black">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a2.25 2.25 0 00-2.25-2.25H15a3 3 0 11-6 0H5.25A2.25 2.25 0 003 12m18 0v6a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 18v-6m18 0V9M3 12V9m18 0a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 9m18 0V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v3" />
              </svg>
            </div>
            <h2 className="text-3xl font-bold mb-3 title-gradient">Connect Your Wallet</h2>
            <p className="text-gray-400 mb-8">Start tracking your learning journey with encrypted privacy on FHEVM blockchain</p>
          </div>
          <button
            className="btn-primary w-full text-lg py-4"
            disabled={isConnected}
            onClick={connect}
          >
            Connect to MetaMask
          </button>
        </div>
      </div>
    );
  }

  if (isDeployed === false) {
    return errorNotDeployed(chainId);
  }

  const sidebarItems = [
    {
      id: "courses" as TabType,
      name: "Course Management",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
        </svg>
      ),
      description: "Create and search courses"
    },
    {
      id: "scores" as TabType,
      name: "Scores & Proofs",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 01-.982-3.172M9.497 14.25a7.454 7.454 0 00.981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 007.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M7.73 9.728a6.726 6.726 0 002.748 1.35m8.272-6.842V4.5c0 2.108-.966 3.99-2.48 5.228m2.48-5.492a46.32 46.32 0 012.916.52 6.003 6.003 0 01-5.395 4.972m0 0a6.726 6.726 0 01-2.749 1.35m0 0a6.772 6.772 0 01-3.044 0" />
        </svg>
      ),
      description: "Upload scores & mint NFTs"
    },
    {
      id: "study" as TabType,
      name: "Study Tracking",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
        </svg>
      ),
      description: "Check-in & study sessions"
    }
  ];

  return (
    <div className="w-full flex gap-6">
      {/* Sidebar */}
      <aside className="w-72 flex-shrink-0">
        <div className="sticky top-6 space-y-3">
          {/* Connection Status */}
          <div className="section-card p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
              <h3 className="text-sm font-semibold text-white">Connected</h3>
            </div>
            <div className="space-y-2 text-xs">
              <div>
                <p className="text-gray-400">Network</p>
                <p className="text-white font-mono">{contractInfo.chainName || `Chain ${chainId}`}</p>
              </div>
              <div>
                <p className="text-gray-400">Account</p>
                <p className="text-[var(--primary-blue)] font-mono">{accounts?.[0]?.slice(0, 8)}...{accounts?.[0]?.slice(-6)}</p>
              </div>
              <div>
                <p className="text-gray-400">FHEVM Status</p>
                <span className={`status-badge ${fhevmStatus === "ready" ? "status-success" : "status-info"} text-xs`}>
                  {fhevmStatus}
                </span>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="space-y-2">
            {sidebarItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full text-left p-4 rounded-xl transition-all duration-300 ${
                  activeTab === item.id
                    ? "bg-gradient-to-br from-[var(--primary-blue)] to-[var(--primary-gold)] text-black shadow-lg glow-effect"
                    : "bg-[var(--card-bg)] text-gray-300 hover:bg-[var(--input-bg)] border-2 border-[var(--card-border)] hover:border-[var(--primary-blue)]"
                }`}
              >
                <div className="flex items-center gap-3 mb-1">
                  {item.icon}
                  <span className="font-semibold">{item.name}</span>
                </div>
                <p className={`text-xs ml-8 ${activeTab === item.id ? "text-black/70" : "text-gray-500"}`}>
                  {item.description}
                </p>
              </button>
            ))}
          </nav>

          {/* Info Card */}
          <div className="section-card p-4">
            <div className="flex items-center gap-2 mb-2">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 text-[var(--primary-blue)]">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
              </svg>
              <h3 className="text-sm font-semibold text-white">Privacy First</h3>
            </div>
            <p className="text-xs text-gray-400 leading-relaxed">
              All your data is encrypted using FHE technology. Your scores and study records remain private on-chain.
            </p>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 min-w-0">
        <div className="space-y-6">
          {/* Course Management Tab */}
          {activeTab === "courses" && (
            <>
              {/* Header */}
              <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[var(--card-bg)] via-[var(--card-bg)] to-[var(--input-bg)] border-2 border-[var(--card-border)] p-6">
                <div className="absolute top-0 right-0 w-64 h-64 bg-[var(--primary-blue)] rounded-full blur-[120px] opacity-10"></div>
                <div className="relative z-10">
                  <div className="flex items-center gap-4 mb-3">
                    <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-[var(--primary-blue)] to-[var(--primary-gold)] flex items-center justify-center glow-effect">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-7 h-7 text-black">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
                      </svg>
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold title-gradient">Course Management</h2>
                      <p className="text-sm text-gray-400 mt-1">Create new courses or search existing ones</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid lg:grid-cols-2 gap-6">
                {/* Create Course */}
                <div className="section-card">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[var(--primary-blue)] to-[var(--primary-gold)] flex items-center justify-center">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 text-black">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-semibold text-white">Create New Course</h3>
                  </div>
                  <div className="space-y-3">
                    <input
                      type="text"
                      placeholder="Enter course name..."
                      value={courseName}
                      onChange={(e) => setCourseName(e.target.value)}
                      className="input-field"
                    />
                    <input
                      type="number"
                      placeholder="Passing threshold (e.g., 60)"
                      value={courseThreshold}
                      onChange={(e) => setCourseThreshold(Number(e.target.value))}
                      className="input-field"
                    />
                    <button
                      className="btn-primary w-full"
                      onClick={createCourse}
                      disabled={isLoading || !courseName}
                    >
                      🔐 Create Encrypted Course
                    </button>
                  </div>
                </div>

                {/* Search Course */}
                <div className="section-card">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[var(--primary-blue)] to-[var(--primary-gold)] flex items-center justify-center">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 text-black">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-semibold text-white">Search Course</h3>
                  </div>
                  <div className="space-y-3">
                    <input
                      type="number"
                      placeholder="Enter course ID..."
                      value={searchCourseId ?? ""}
                      onChange={(e) => setSearchCourseId(e.target.value ? Number(e.target.value) : null)}
                      className="input-field"
                    />
                    <button
                      className="btn-primary w-full"
                      onClick={searchCourse}
                      disabled={isLoading || searchCourseId === null}
                    >
                      🔍 Search Course
                    </button>

                    {searchedCourse && searchedCourse.exists && (
                      <div className="mt-4 p-4 rounded-lg bg-[var(--input-bg)] border border-[var(--input-border)]">
                        <p className="text-white font-semibold mb-2">📚 {searchedCourse.name}</p>
                        <p className="text-xs text-gray-400 mb-3 break-all">Threshold: {searchedCourse.thresholdHandle.slice(0, 20)}...</p>
                        <div className="text-xs text-gray-500 mb-3">
                          Course ID: {searchCourseId}
                        </div>
                        <div className="flex gap-2">
                          <button
                            className="btn-primary flex-1 text-sm py-2"
                            onClick={() => {
                              setSelectedCourseId(searchCourseId);
                              setActiveTab("scores");
                            }}
                          >
                            Use for Score
                          </button>
                          <button
                            className="btn-primary flex-1 text-sm py-2"
                            onClick={() => {
                              setProofCourseId(searchCourseId);
                              setActiveTab("scores");
                            }}
                          >
                            Use for Proof
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Scores & Proofs Tab */}
          {activeTab === "scores" && (
            <>
              {/* Header */}
              <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[var(--card-bg)] via-[var(--card-bg)] to-[var(--input-bg)] border-2 border-[var(--card-border)] p-6">
                <div className="absolute top-0 right-0 w-64 h-64 bg-[var(--primary-gold)] rounded-full blur-[120px] opacity-10"></div>
                <div className="relative z-10">
                  <div className="flex items-center gap-4 mb-3">
                    <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-[var(--primary-blue)] to-[var(--primary-gold)] flex items-center justify-center glow-gold">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-7 h-7 text-black">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 01-.982-3.172M9.497 14.25a7.454 7.454 0 00.981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 007.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M7.73 9.728a6.726 6.726 0 002.748 1.35m8.272-6.842V4.5c0 2.108-.966 3.99-2.48 5.228m2.48-5.492a46.32 46.32 0 012.916.52 6.003 6.003 0 01-5.395 4.972m0 0a6.726 6.726 0 01-2.749 1.35m0 0a6.772 6.772 0 01-3.044 0" />
                      </svg>
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold title-gradient">Scores & Achievements</h2>
                      <p className="text-sm text-gray-400 mt-1">Upload scores and generate skill proof NFTs</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                {/* Upload Score */}
                <div className="section-card">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[var(--primary-blue)] to-[var(--primary-gold)] flex items-center justify-center">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 text-black">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-semibold text-white">Upload Encrypted Score</h3>
                  </div>
                  <div className="grid md:grid-cols-2 gap-3">
                    <input
                      type="number"
                      placeholder="Course ID"
                      value={selectedCourseId ?? ""}
                      onChange={(e) => setSelectedCourseId(e.target.value ? Number(e.target.value) : null)}
                      className="input-field"
                    />
                    <input
                      type="number"
                      placeholder="Your score (0-100)"
                      value={score}
                      onChange={(e) => setScore(Number(e.target.value))}
                      className="input-field"
                    />
                    <button
                      className="btn-primary md:col-span-2"
                      onClick={uploadScore}
                      disabled={isLoading || selectedCourseId === null}
                    >
                      🔒 Submit Encrypted Score
                    </button>
                  </div>
                </div>

                {/* Skill Proof NFT */}
                <div className="section-card">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[var(--primary-blue)] to-[var(--primary-gold)] flex items-center justify-center glow-gold">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 text-black">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 01-.982-3.172M9.497 14.25a7.454 7.454 0 00.981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 007.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M7.73 9.728a6.726 6.726 0 002.748 1.35m8.272-6.842V4.5c0 2.108-.966 3.99-2.48 5.228m2.48-5.492a46.32 46.32 0 012.916.52 6.003 6.003 0 01-5.395 4.972m0 0a6.726 6.726 0 01-2.749 1.35m0 0a6.772 6.772 0 01-3.044 0" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-semibold text-white">Skill Proof NFT</h3>
                  </div>
                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="space-y-3">
                      <p className="text-sm text-gray-400 mb-2">Generate Skill Proof</p>
                      <input
                        type="number"
                        placeholder="Course ID for proof generation"
                        value={proofCourseId ?? ""}
                        onChange={(e) => setProofCourseId(e.target.value ? Number(e.target.value) : null)}
                        className="input-field"
                      />
                      <button
                        className="btn-primary w-full"
                        onClick={generateSkillProof}
                        disabled={isLoading || proofCourseId === null}
                      >
                        🎓 Generate Skill Proof NFT
                      </button>
                    </div>

                    <div className="space-y-3">
                      <p className="text-sm text-gray-400 mb-2">Query Skill Proof</p>
                      <input
                        type="number"
                        placeholder="Skill ID to query"
                        value={querySkillId ?? ""}
                        onChange={(e) => setQuerySkillId(e.target.value ? Number(e.target.value) : null)}
                        className="input-field"
                      />
                      <button
                        className="btn-primary w-full"
                        onClick={getSkillProofInfo}
                        disabled={isLoading || querySkillId === null}
                      >
                        🔍 Get Skill Proof Info
                      </button>
                    </div>
                  </div>

                  {skillInfo && (
                    <div className="mt-4 p-4 rounded-lg bg-[var(--input-bg)] border border-[var(--primary-gold)]">
                      <h4 className="text-white font-semibold mb-3 flex items-center gap-2">
                        <span className="text-[var(--primary-gold)]">🏆</span>
                        Skill Proof Details
                      </h4>
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <p className="text-gray-400">Skill ID</p>
                          <p className="text-white font-mono">{skillInfo.skillId}</p>
                        </div>
                        <div>
                          <p className="text-gray-400">Course ID</p>
                          <p className="text-white font-mono">{skillInfo.courseId}</p>
                        </div>
                        <div>
                          <p className="text-gray-400">Timestamp</p>
                          <p className="text-white">{new Date((skillInfo.timestamp ?? 0) * 1000).toLocaleString()}</p>
                        </div>
                        {typeof skillInfo.passed !== "undefined" && (
                          <div>
                            <p className="text-gray-400">Status</p>
                            <span className={`status-badge ${skillInfo.passed ? "status-success" : "status-error"}`}>
                              {skillInfo.passed ? "✅ Passed" : "❌ Not Passed"}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {/* Study Tracking Tab */}
          {activeTab === "study" && (
            <>
              {/* Header */}
              <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[var(--card-bg)] via-[var(--card-bg)] to-[var(--input-bg)] border-2 border-[var(--card-border)] p-6">
                <div className="absolute top-0 right-0 w-64 h-64 bg-green-500 rounded-full blur-[120px] opacity-10"></div>
                <div className="relative z-10">
                  <div className="flex items-center gap-4 mb-3">
                    <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-[var(--primary-blue)] to-[var(--primary-gold)] flex items-center justify-center glow-effect">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-7 h-7 text-black">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
                      </svg>
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold title-gradient">Study Tracking</h2>
                      <p className="text-sm text-gray-400 mt-1">Track your daily progress and study habits</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid lg:grid-cols-2 gap-6">
                {/* Daily Check-in */}
                <div className="section-card">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[var(--primary-blue)] to-[var(--primary-gold)] flex items-center justify-center">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 text-black">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-semibold text-white">Daily Check-in</h3>
                  </div>
                  <div className="space-y-3">
                    <input
                      type="number"
                      placeholder="Study time (minutes)"
                      value={studyTime}
                      onChange={(e) => setStudyTime(Number(e.target.value))}
                      className="input-field"
                    />
                    <button
                      className="btn-primary w-full"
                      onClick={checkIn}
                      disabled={isLoading}
                    >
                      📝 Record Check-in
                    </button>
                    <div className="mt-4 p-3 rounded-lg bg-[var(--input-bg)] border border-[var(--input-border)]">
                      <p className="text-xs text-gray-400">
                        💡 Daily check-ins help you maintain your learning streak and track consistency.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Record Study Data */}
                <div className="section-card">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[var(--primary-blue)] to-[var(--primary-gold)] flex items-center justify-center">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 text-black">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-semibold text-white">Record Study Session</h3>
                  </div>
                  <div className="space-y-3">
                    <input
                      type="number"
                      placeholder="Study time (minutes)"
                      value={studyTime}
                      onChange={(e) => setStudyTime(Number(e.target.value))}
                      className="input-field"
                    />
                    <input
                      type="number"
                      placeholder="Focus level (0-100)"
                      value={focusLevel}
                      onChange={(e) => setFocusLevel(Number(e.target.value))}
                      className="input-field"
                    />
                    <button
                      className="btn-primary w-full"
                      onClick={recordStudyData}
                      disabled={isLoading}
                    >
                      📊 Record Encrypted Study Data
                    </button>
                    <div className="mt-4 p-3 rounded-lg bg-[var(--input-bg)] border border-[var(--input-border)]">
                      <p className="text-xs text-gray-400">
                        🔒 Your study time and focus level are encrypted on-chain for privacy-preserving analytics.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Message Display */}
          {message && (
            <div className={`p-4 rounded-lg border-2 ${
              messageType === "success" ? "bg-green-900/20 border-[var(--success)]" :
              messageType === "error" ? "bg-red-900/20 border-[var(--error)]" :
              "bg-blue-900/20 border-[var(--primary-blue)]"
            }`}>
              <p className={`font-medium ${
                messageType === "success" ? "text-[var(--success)]" :
                messageType === "error" ? "text-[var(--error)]" :
                "text-[var(--primary-blue)]"
              }`}>{message}</p>
            </div>
          )}
        </div>
      </main>

      {/* Loading Overlay */}
      {isLoading && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="section-card max-w-sm animate-pulse-glow">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full border-4 border-[var(--primary-blue)] border-t-[var(--primary-gold)] animate-spin"></div>
              <div>
                <p className="text-white font-semibold">Processing...</p>
                <p className="text-sm text-gray-400">Please wait while transaction is being confirmed</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
