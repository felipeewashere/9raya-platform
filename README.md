# 9raya — plateforme d'apprentissage interactive (S1)

Cours universitaires découpés en leçons courtes, avec démonstrations pas à pas, widgets mathématiques interactifs, quiz corrigés et expliqués, XP, niveaux, séries quotidiennes et succès. Site **statique** hébergé sur GitHub Pages.

- **Front** : Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · shadcn/ui (Radix) · Motion · KaTeX
- **Hébergement** : export statique Next.js (`output: "export"`, base `/9raya-platform`) sur GitHub Pages
- **Back** : Supabase (PostgreSQL + RLS, Auth e-mail et Google, Storage) + Edge Function `api` (correction, XP, progression, suppression de compte)
- **Contenu** : Algèbre 1 complet (5 chapitres, 77 leçons, 541 questions) dans `content/algebre-1/`

---

## 1. Installation locale

```bash
npm install
cp .env.example .env.local     # puis remplis les valeurs (voir §2)
npm run db:push                # applique les migrations SQL sur ton projet Supabase
npm run content:import         # importe Algèbre 1 dans la base
npm run dev                    # http://localhost:3000/9raya-platform/
```

Pour tester le site exactement comme sur GitHub Pages : `npm run build && npm run serve:out` → <http://localhost:3000/9raya-platform/>.

## 2. Configurer Supabase

1. Crée un projet sur <https://supabase.com/dashboard> (région conseillée : Europe).
2. **Project Settings → API** : copie dans `.env.local`
   - `NEXT_PUBLIC_SUPABASE_URL` (Project URL)
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` (clé `anon` / publishable)
   - `SUPABASE_SERVICE_ROLE_KEY` (clé secrète — **jamais dans le build du site ni dans git** ; seulement pour `content:import` et `test:e2e` en local. L'Edge Function la reçoit de Supabase.)
3. **Project Settings → Database → Connection string → Session pooler** : copie l'URI (avec ton mot de passe DB) dans `SUPABASE_DB_URL`, puis `npm run db:push`.
   *Sans terminal* : tu peux aussi coller les fichiers de `supabase/migrations/` dans l'éditeur SQL de Supabase, **dans l'ordre**.
4. **Authentication → URL Configuration**
   - Site URL : `https://felipeewashere.github.io/9raya-platform/`
   - Redirect URLs : `https://felipeewashere.github.io/9raya-platform/**` et `http://localhost:3000/9raya-platform/**`
     (les liens arrivent sur `/9raya-platform/auth/callback/?suivant=…`)
5. **Authentication → Providers → Email** : laisse « Confirm email » activé (vérification d'adresse).

### Connexion Google

1. Google Cloud Console → APIs & Services → Credentials → *Create OAuth client ID* (type **Web application**).
2. *Authorized redirect URI* : `https://TON-PROJET.supabase.co/auth/v1/callback` (affichée dans Supabase → Authentication → Providers → Google).
3. Colle le *Client ID* et le *Client secret* dans Supabase → Providers → Google, et active-le.

## 3. Commandes

| Commande | Rôle |
|---|---|
| `npm run dev` | serveur de développement |
| `npm run build` | export statique dans `out/` |
| `npm run serve:out` | sert `out/` sous `/9raya-platform/` comme GitHub Pages |
| `npm run edge:sync` | recopie `grade.ts`, `types.ts`, `gamification.ts` dans `supabase/functions/api/shared/` |
| `npm test` | tests (RLS et fonctions SQL sur un Postgres embarqué, moteur de correction, import, widgets) |
| `npm run test:e2e` | parcours complet dans Edge sur le site statique (`npm run serve:out` lancé à côté) contre le vrai projet Supabase — crée puis supprime un compte de test |
| `npm run typecheck` / `npm run lint` | vérifications TypeScript / ESLint |
| `npm run content:validate` | valide les fichiers `content/**/chNN.json` (schéma + rendu KaTeX de chaque formule) |
| `npm run content:import [-- algebre-1] [--draft] [--prune]` | importe/met à jour le contenu dans la base |
| `npm run db:push` | applique les migrations |

## 4. Architecture

```
src/
  app/
    page.tsx                         accueil (questionnaire)
    (auth)/connexion, inscription…   authentification (supabase-js dans le navigateur)
    auth/callback                    retour Google / liens e-mail (PKCE, côté client)
    (app)/tableau-de-bord, cours, td, classement, profil, parametres
    (reader)/cours/[course]/[chapter]/[lesson](/quiz)   lecteur de leçon et quiz
    search-index.json                index de recherche généré au build
  components/                        UI, leçon, quiz, widgets, récompenses, shell (garde de session)
  content/schema.ts                  format du contenu (zod)
  lib/content/static.ts              contenu lu au BUILD depuis content/ (partie publique seulement)
  lib/data/, lib/actions/            requêtes et actions dans le navigateur (RLS) + appels à l'Edge Function
  lib/quiz/                          découpage public/secret et correction des réponses
  lib/content/import.ts              import idempotent du contenu
supabase/functions/api/              Edge Function (Deno) : correction, XP, séries, succès, passer une leçon, suppression de compte
supabase/migrations/                 schéma, RLS, fonctions, stockage, données de référence
.github/workflows/pages.yml          build + déploiement GitHub Pages à chaque push sur main
content/algebre-1/ch01…ch05.json     contenu d'Algèbre 1
tests/                               tests Vitest
```

**Hiérarchie** : semestre → cours → chapitre → section → leçon → blocs (définition, théorème, démonstration pas à pas, exemple, remarque, « en clair », exercice, widget interactif, question de vérification) + quiz de fin de leçon.

**Sécurité**
- RLS sur toutes les tables. Les élèves lisent le contenu publié et uniquement leurs propres données.
- Les pages n'embarquent que la partie publique des questions (ni réponses ni explications). Les bonnes réponses sont dans `question_answers` ; la correction se fait dans l'Edge Function `api`, qui vérifie le jeton de l'élève.
- Un quiz est une tentative ouverte côté serveur : seule la **première** réponse à chaque question compte.
- Progression, XP, séries et succès sont écrits uniquement par l'Edge Function (clé service_role, côté Supabase) via des fonctions SQL dont l'exécution est interdite aux clients. La garde de session des pages est côté client ; la vraie protection est RLS + l'Edge Function.
- XP : un gain par (raison, élément) — refaire un quiz ne rapporte rien de plus (pas de farming).

**Gamification** : +2 XP question de leçon (1re bonne réponse), +10 leçon terminée, +20 quiz réussi (70 %), +10 sans faute, +50 chapitre, +200 module, +5 par jour de série (≥ 2 jours). Niveau *n* à 25·n·(n−1) XP. Série = jours consécutifs avec de l'XP, selon le fuseau horaire de l'élève. Le chapitre *k+1* se débloque quand la moitié du chapitre *k* est terminée (option `sequential` du cours).

## 5. Ajouter un cours (ex. Analyse 1)

En ligne de commande : crée `content/analyse-1/ch01.json` (format de `src/content/schema.ts`, widgets listés dans `content/WIDGETS.md`), puis `npm run content:validate`, `npm run content:import -- analyse-1` et pousse sur `main` : les pages sont régénérées depuis `content/` au build (le contenu du site et celui de la base doivent rester identiques).

## 6. Déploiement (GitHub Pages)

1. GitHub → Settings → Secrets and variables → Actions : ajoute `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` et `NEXT_PUBLIC_SITE_URL` (`https://felipeewashere.github.io/9raya-platform`). **Pas** de clé service_role.
2. Settings → Pages → Source : **GitHub Actions**. Chaque push sur `main` lance `.github/workflows/pages.yml`.
3. Edge Function : `supabase functions deploy api --no-verify-jwt` (elle vérifie elle-même le jeton). Après un changement de `src/lib/quiz/grade.ts`, `types.ts` ou `gamification.ts` : `npm run edge:sync` puis redéploie.
4. Supabase envoie les e-mails avec un service limité : en production, configure un SMTP (Authentication → SMTP).

## 7. Animations

Les animations suivent le réglage système « réduire les animations ». Les vidéos de `public/media/` (générées avec Higgsfield) se remplacent dans `public/media/`. Les fichiers sources sont dans `media-src/`.
