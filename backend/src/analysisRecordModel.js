import mongoose from 'mongoose';

const AnalysisRecordSchema = new mongoose.Schema(
  {
    studentId: { type: String, default: '' },
    studentName: { type: String, default: '' },
    roleId: { type: String, default: '' },
    roleName: { type: String, required: true },
    includeAiAdvisor: { type: Boolean, default: false },
    requestPayload: { type: mongoose.Schema.Types.Mixed, default: {} },
    analysisPayload: { type: mongoose.Schema.Types.Mixed, default: {} },
    aiAdvisor: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  {
    timestamps: true,
  },
);

export const AnalysisRecord = mongoose.model('AnalysisRecord', AnalysisRecordSchema);
