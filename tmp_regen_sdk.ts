import { createClient } from "@hey-api/openapi-ts"
import path from "path"

const dir = path.resolve("packages/sdk/js")

await createClient({
  input: path.join(dir, "openapi.json"),
  output: {
    path: path.join(dir, "src/v2/gen"),
    tsConfigPath: path.join(dir, "tsconfig.json"),
    clean: true,
  },
  plugins: [
    {
      name: "@hey-api/typescript",
      exportFromIndex: false,
    },
    {
      name: "@hey-api/sdk",
      instance: "OpencodeClient",
      exportFromIndex: false,
      auth: false,
      paramsStructure: "flat",
    },
    {
      name: "@hey-api/client-fetch",
      exportFromIndex: false,
      baseUrl: "http://localhost:4096",
    },
  ],
})
