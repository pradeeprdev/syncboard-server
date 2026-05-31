import mongoose from "mongoose";

const activitySchema = new mongoose.Schema(
  {
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: "Project", index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    action: { type: String },
    entityType: { type: String },
    entityId: { type: mongoose.Schema.Types.ObjectId },
    metadata: { type: mongoose.Schema.Types.Mixed }
  },
  { timestamps: true }
);

activitySchema.index({ projectId: 1, createdAt: -1 });

export default mongoose.model("ActivityLog", activitySchema);
