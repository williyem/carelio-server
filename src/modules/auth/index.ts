import { Router } from 'express';
import doctorRoutes from './doctor.routes';
import healthAssistantRoutes from './health-assistant.routes';
import patientRoutes from './patient.routes';

const authRouter = Router();

authRouter.use('/doctor', doctorRoutes);
authRouter.use('/assistant', healthAssistantRoutes);
authRouter.use('/patient', patientRoutes);

export default authRouter;
