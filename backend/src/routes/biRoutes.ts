import { Router } from "express";
import {
  biDatasetController,
  biExportCsvController,
  biExportJsonController,
  powerBiEmbedConfigController,
} from "../controllers/biController";

const biRoutes = Router();

biRoutes.get("/dataset", biDatasetController);
biRoutes.get("/export/json", biExportJsonController);
biRoutes.get("/export/csv", biExportCsvController);
biRoutes.get("/powerbi/embed-config", powerBiEmbedConfigController);

export default biRoutes;
