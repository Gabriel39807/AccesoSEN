import { registerHooks } from "node:module";

const TS_CANDIDATE_EXTENSIONS = [".ts", ".tsx", ".mts", ".cts"];

function isRelativeSpecifier(specifier) {
  return specifier.startsWith("./") || specifier.startsWith("../");
}

function hasFileExtension(specifier) {
  return /\.[^/]+$/u.test(specifier);
}

registerHooks({
  resolve(specifier, context, nextResolve) {
    try {
      return nextResolve(specifier, context);
    } catch (error) {
      if (error?.code !== "ERR_MODULE_NOT_FOUND" || !isRelativeSpecifier(specifier) || hasFileExtension(specifier)) {
        throw error;
      }

      for (const extension of TS_CANDIDATE_EXTENSIONS) {
        try {
          return nextResolve(`${specifier}${extension}`, context);
        } catch (candidateError) {
          if (candidateError?.code !== "ERR_MODULE_NOT_FOUND") {
            throw candidateError;
          }
        }
      }

      throw error;
    }
  },
});
