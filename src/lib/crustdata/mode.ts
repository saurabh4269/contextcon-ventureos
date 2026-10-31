export class CrustdataConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CrustdataConfigError";
  }
}
