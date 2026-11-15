/**
 * Interactive simulations available in lessons and TD exercises.
 * Content refers to a scene by name: `{ "type": "simulation", "scene": "gauss-surface", "params": { "shape": "cylinder" } }`.
 * Each scene lives in src/components/sim/scenes/<name>.tsx (default export, props `{ params }`).
 */
export const SIM_SCENES = {
  // ---- physics, 3D (rotate with the mouse / finger)
  "cylindrical-coords": "Coordonnées cylindriques : point M, ρ, φ, z et base (e_ρ, e_φ, e_z)",
  "spherical-coords": "Coordonnées sphériques : point M, r, θ, φ et base (e_r, e_θ, e_φ)",
  "vector-products": "Produit scalaire et produit vectoriel de deux vecteurs réglables",
  "frenet-helix": "Mouvement sur une hélice : vitesse, accélération, base de Frenet",
  projectile: "Chute libre / tir : trajectoire parabolique, vecteurs vitesse et accélération",
  "circular-motion": "Mouvement circulaire : vitesse tangente, accélération normale et tangentielle",
  "rotating-rod": "Anneau sur une tige en rotation : vitesses relative, d'entraînement, absolue",
  pendulum: "Pendule simple : forces (poids, tension), angle, période",
  "point-charges": "Charges ponctuelles : lignes de champ et équipotentielles, charges réglables",
  "charged-distribution": "Champ d'une distribution : fil, anneau, disque (params.shape)",
  "gauss-surface": "Théorème de Gauss : surface de Gauss et flux (params.shape: sphere | cylinder | plane)",
  conductor: "Conducteur en équilibre : charges en surface, E nul dedans, effet de pointe",
  // ---- maths, 2D (drag / sliders)
  "sequence-limit": "Limite d'une suite : bande ε autour de ℓ et rang N",
  "function-limit": "Limite d'une fonction : ε–δ autour d'un point",
  "sup-inf": "Borne supérieure / inférieure d'une partie de ℝ sur la droite réelle",
  "recurrent-sequence": "Suite récurrente u_{n+1} = f(u_n) : diagramme en escalier / toile",
  "tangent-derivative": "Nombre dérivé : sécante qui tend vers la tangente",
  ivt: "Théorème des valeurs intermédiaires",
  "mean-value": "Rolle et accroissements finis",
  "linear-map-2d": "Application linéaire du plan : matrice 2×2 réglable qui déforme la grille",
} as const;

export type SimScene = keyof typeof SIM_SCENES;
export const SIM_SCENE_NAMES = Object.keys(SIM_SCENES) as [SimScene, ...SimScene[]];
