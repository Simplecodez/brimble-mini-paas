import { singleton } from "tsyringe";
import { DeploymentService } from "./deployment.service";
import { catchAsync } from "../../utils/catch-async.utils";

@singleton()
export class DeploymentController {
  constructor(private readonly deploymentService: DeploymentService) {}

  createDeployment() {
    return catchAsync(async (request) => {
      const sourceType =
        request.body.sourceType === "upload" ? "upload" : "git";

      const deployment =
        sourceType === "git"
          ? this.deploymentService.createDeployment({
              sourceType,
              gitUrl: request.body.gitUrl,
            })
          : this.deploymentService.createDeployment({
              sourceType,
              uploadPath: request.file?.path,
              uploadOriginalName: request.file?.originalname,
            });

      return {
        status: "success",
        statusCode: 201,
        deployment,
      };
    });
  }

  getDeployments() {
    return catchAsync(async () => {
      const deployments = this.deploymentService.getDeployments();
      return {
        status: "success",
        statusCode: 200,
        deployments,
      };
    });
  }

  getDeployment() {
    return catchAsync(async (request) => {
      const result = this.deploymentService.getDeployment(
        request.params.id as string,
      );
      return result;
    });
  }
}
