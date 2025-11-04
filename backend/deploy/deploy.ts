import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;

  const deployedTracker = await deploy("EncryptedLearningTracker", {
    from: deployer,
    log: true,
  });

  console.log(`EncryptedLearningTracker contract: `, deployedTracker.address);
};
export default func;
func.id = "deploy_encryptedLearningTracker"; // id required to prevent reexecution
func.tags = ["EncryptedLearningTracker"];

