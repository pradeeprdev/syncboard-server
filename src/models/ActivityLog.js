import mongoose from "mongoose";

const activitySchema = new mongoose.Schema(
  {
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    action: String,
    entityType: String,
    entityId: mongoose.Schema.Types.ObjectId,
    metadata: mongoose.Schema.Types.Mixed,
  },
  { timestamps: true }
);

activitySchema.index({ projectId: 1, createdAt: -1 });

export default mongoose.model("ActivityLog", activitySchema);