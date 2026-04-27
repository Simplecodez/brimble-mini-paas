import { NextFunction, Request, Response } from "express";
import { AppError } from "./app-error.utils";

export class GlobalErrorHandler {
  static handleBadJsonFormatError(): AppError {
    return new AppError(
      "Invalid JSON format, please check your request body.",
      400,
    );
  }

  static sendError(err: AppError, res: Response) {
    if (err.isOperational) {
      return res.status(err.statusCode).json({
        status: err.status,
        message: err.message,
      });
    }

    console.log(err);

    return res.status(500).json({
      status: "error",
      message: "Sorry, an error occurred. Please try again later.",
    });
  }

  static errorHandler() {
    return (error: any, req: Request, res: Response, next: NextFunction) => {
      if (error instanceof SyntaxError && "body" in error)
        error = this.handleBadJsonFormatError();

      this.sendError(error, res);
    };
  }
}
