export function errorNotDeployed(chainId: number | undefined) {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="section-card max-w-2xl w-full">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center flex-shrink-0">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-8 h-8 text-white">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
          </div>
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-white mb-2">Contract Not Deployed</h2>
            <p className="text-gray-300 mb-4">
              The EncryptedLearningTracker contract is not deployed on <span className="status-badge status-error">Chain ID: {chainId}</span>
            </p>
            <div className="bg-[var(--input-bg)] border border-[var(--input-border)] rounded-lg p-4">
              <p className="text-sm text-gray-400 mb-2">To deploy the contract, run:</p>
              <code className="block bg-black/50 text-[var(--primary-blue)] px-4 py-3 rounded font-mono text-sm border border-[var(--input-border)]">
                cd backend && npx hardhat deploy --network hardhat
              </code>
            </div>
            <div className="mt-4 p-3 bg-yellow-900/20 border border-yellow-600/50 rounded-lg">
              <p className="text-yellow-400 text-sm">
                💡 <strong>Tip:</strong> Make sure you're connected to the correct network where the contract is deployed.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

