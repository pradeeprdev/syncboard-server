import mongoose from "mongoose";

const memberSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    role: {
      type: String,
      enum: ["admin", "member", "viewer"],
      default: "member",
    },
    joinedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const projectSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Project name is required"],
      trim: true,
      maxlength: 80,
    },
    description: {
      type: String,
      default: "",
      maxlength: 500,
    },
    status: {
      type: String,
      enum: ["active", "archived"],
      default: "active",
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    members: [memberSchema],
  },
  { timestamps: true }
);

projectSchema.index({ createdBy: 1 });
projectSchema.index({ "members.user": 1 });

export default mongoose.model("Project", projectSchema);