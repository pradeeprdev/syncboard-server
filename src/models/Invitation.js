import mongoose from "mongoose";

const invitationSchema = new mongoose.Schema(
  {
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: "Project", required: true, index: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    role: { type: String, enum: ["admin", "member", "viewer"], default: "member" },
    tokenHash: { type: String, required: true, index: true },
    expiresAt: { type: Date, required: true, index: true },
    acceptedAt: { type: Date }
  },
  { timestamps: true }
);

export default mongoose.model("Invitation", invitationSchema);
