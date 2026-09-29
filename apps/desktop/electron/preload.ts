import { contextBridge } from "electron";

contextBridge.exposeInMainWorld("zugrio", {
  releaseChannel: "private-validation-alpha"
});
