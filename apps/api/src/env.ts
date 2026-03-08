import * as dotenv from "dotenv";
import path from "path";

// __dirname is apps/api/src
// ../../../ is SolarEcoHeat
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });
