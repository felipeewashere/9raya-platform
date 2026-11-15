"use client";

import type { ComponentType } from "react";
import type { SimScene } from "@/content/sim-scenes";

export type SceneProps = { params?: Record<string, unknown> };

/** Lazy loaders, one per scene (each scene is its own chunk, three.js only loads when needed). */
export const SCENE_LOADERS: Record<SimScene, () => Promise<{ default: ComponentType<SceneProps> }>> = {
  "cylindrical-coords": () => import("./scenes/cylindrical-coords"),
  "spherical-coords": () => import("./scenes/spherical-coords"),
  "vector-products": () => import("./scenes/vector-products"),
  "frenet-helix": () => import("./scenes/frenet-helix"),
  "projectile": () => import("./scenes/projectile"),
  "circular-motion": () => import("./scenes/circular-motion"),
  "rotating-rod": () => import("./scenes/rotating-rod"),
  "pendulum": () => import("./scenes/pendulum"),
  "point-charges": () => import("./scenes/point-charges"),
  "charged-distribution": () => import("./scenes/charged-distribution"),
  "gauss-surface": () => import("./scenes/gauss-surface"),
  "conductor": () => import("./scenes/conductor"),
  "sequence-limit": () => import("./scenes/sequence-limit"),
  "function-limit": () => import("./scenes/function-limit"),
  "sup-inf": () => import("./scenes/sup-inf"),
  "recurrent-sequence": () => import("./scenes/recurrent-sequence"),
  "tangent-derivative": () => import("./scenes/tangent-derivative"),
  "ivt": () => import("./scenes/ivt"),
  "mean-value": () => import("./scenes/mean-value"),
  "linear-map-2d": () => import("./scenes/linear-map-2d"),
};
