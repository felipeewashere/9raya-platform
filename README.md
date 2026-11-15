# 9raya — plateforme d'apprentissage interactive (S1)

Cours universitaires découpés en leçons courtes, avec démonstrations pas à pas, widgets mathématiques interactifs, quiz corrigés et expliqués, XP, niveaux, séries quotidiennes, succès et un espace d'administration complet.

- **Front** : Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · shadcn/ui (Radix) · Motion · KaTeX
- **Back** : Supabase (PostgreSQL + RLS, Auth e-mail et Google, Storage)
- **Contenu** : Algèbre 1 complet (5 chapitres, 77 leçons, 541 questions) dans `content/algebre-1/`

---

## 1. Installation locale

```bash
npm install
cp .env.example .env.local     # puis remplis les valeurs (voir §2)
npm run db:push                # applique les migrations SQL sur ton projet Supabase
npm run content:import         # importe Algèbre 1 dans la base
npm run dev                    # http://localhost:3000
```

Tant que `.env.local` n'est pas rempli, le site affiche une page « Configuration requise ».

## 2. Configurer Supabase

1. Crée un projet sur <https://supabase.com/dashboard> (région conseillée : Europe).
2. **Project Settings → API** : copie dans `.env.local`
   - `NEXT_PUBLIC_SUPABASE_URL` (Project URL)
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` (clé `anon` / publishable)
   - `SUPABASE_SERVICE_ROLE_KEY` (clé `service_role` / secret — **ne jamais l'exposer côté client ni la commiter**)
3. **Project Settings → Database → Connection string → Session pooler** : copie l'URI (avec ton mot de passe DB) dans `SUPABASE_DB_URL`, puis `npm run db:push`.
   *Sans terminal* : tu peux aussi coller les fichiers de `supabase/migrations/` dans l'éditeur SQL de Supabase, **dans l'ordre**.
4. **Authentication → URL Configuration**
   - Site URL : `http://localhost:3000` (puis ton domaine en production)
   - Redirect URLs : `http://localhost:3000/auth/callback` et `https://TON-DOMAINE/auth/callback`
5. **Authentication → Providers → Email** : laisse « Confirm email » activé (vérification d'adresse).

### Connexion Google

1. Google Cloud Console → APIs & Services → Credentials → *Create OAuth client ID* (type **Web application**).
2. *Authorized redirect URI* : `https://TON-PROJET.supabase.co/auth/v1/callback` (affichée dans Supabase → Authentication → Providers → Google).
3. Colle le *Client ID* et le *Client secret* dans Supabase → Providers → Google, et active-le.

### Devenir administrateur

Inscris-toi sur le site, puis :

```bash
npm run admin:grant -- ton@email.com
```

Le lien **Administration** apparaît dans le menu du compte (`/admin`). Le rôle est vérifié côté serveur à chaque page et à chaque action.

## 3. Commandes

| Commande | Rôle |
|---|---|
| `npm run dev` | serveur de développement |
| `npm run build` / `npm start` | build et serveur de production |
| `npm test` | tests (RLS et fonctions SQL sur un Postgres embarqué, moteur de correction, widgets, admin) |
| `npm run test:e2e` | parcours complets dans Edge contre le vrai projet Supabase (serveur lancé sur le port 3100 : `npx next start -p 3100`) — crée puis supprime des comptes de test |
| `npm run typecheck` / `npm run lint` | vérifications TypeScript / ESLint |
| `npm run content:validate` | valide les fichiers `content/**/chNN.json` (schéma + rendu KaTeX de chaque formule) |
| `npm run content:import [-- algebre-1] [--draft] [--prune]` | importe/met à jour le contenu dans la base |
| `npm run db:push` | applique les migrations |
| `npm run admin:grant -- email` | donne le rôle admin |

## 4. Architecture

```
src/
  app/
    page.tsx                         accueil public
    (auth)/connexion, inscription…   authentification
    auth/callback                    retour Google / liens e-mail
    (app)/tableau-de-bord, cours, cours/[course], favoris, profil, parametres, bienvenue
    (reader)/cours/[course]/[chapter]/[lesson](/quiz)   lecteur de leçon et quiz
    admin/…                          espace d'administration (rôle admin)
    actions/                         server actions (learning, auth, profile, admin)
  components/                        UI, leçon, quiz, widgets, récompenses, shell
  content/schema.ts                  format du contenu (zod)
  lib/quiz/                          découpage public/secret et correction des réponses
  lib/content/import.ts              import idempotent du contenu
  lib/data/                          requêtes (catalogue, leçon, statistiques)
  proxy.ts                           rafraîchit la session, protège les pages privées
supabase/migrations/                 schéma, RLS, fonctions, stockage, données de référence
content/algebre-1/ch01…ch05.json     contenu d'Algèbre 1
tests/                               tests Vitest
```

**Hiérarchie** : semestre → cours → chapitre → section → leçon → blocs (définition, théorème, démonstration pas à pas, exemple, remarque, « en clair », exercice, widget interactif, question de vérification) + quiz de fin de leçon.

**Sécurité**
- RLS sur toutes les tables. Les élèves lisent le contenu publié et uniquement leurs propres données.
- Les bonnes réponses sont dans `question_answers`, lisible par les admins seulement. La correction se fait sur le serveur.
- Un quiz est une tentative ouverte côté serveur : seule la **première** réponse à chaque question compte.
- Progression, XP, séries et succès sont écrits uniquement par le serveur (clé service_role) via des fonctions SQL dont l'exécution est interdite aux clients.
- XP : un gain par (raison, élément) — refaire un quiz ne rapporte rien de plus (pas de farming).

**Gamification** : +2 XP question de leçon (1re bonne réponse), +10 leçon terminée, +20 quiz réussi (70 %), +10 sans faute, +50 chapitre, +200 module, +5 par jour de série (≥ 2 jours). Niveau *n* à 25·n·(n−1) XP. Série = jours consécutifs avec de l'XP, selon le fuseau horaire de l'élève. Le chapitre *k+1* se débloque quand la moitié du chapitre *k* est terminée (option `sequential` du cours).

## 5. Ajouter un cours (ex. Analyse 1)

Sans toucher au code :
1. **Admin → Contenu** : le cours `analyse-1` existe déjà en « Bientôt disponible ». Passe-le en « Publié » quand le contenu est prêt.
2. Ajoute les chapitres, sections et leçons dans l'éditeur, **ou** passe par **Admin → Imports PDF** : dépose le PDF, relis le texte extrait page par page, écris/colle le chapitre au format JSON (validé en direct), importe-le en brouillon, prévisualise, puis publie.
3. Pour un nouveau semestre : Admin → Contenu → Semestres.

En ligne de commande : crée `content/analyse-1/ch01.json` (format de `src/content/schema.ts`, widgets listés dans `content/WIDGETS.md`), puis `npm run content:validate` et `npm run content:import -- analyse-1 --draft`.

## 6. Déploiement (Vercel)

1. Pousse le dossier sur GitHub et importe-le dans Vercel (framework : Next.js).
2. Ajoute les variables d'environnement : `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SITE_URL=https://ton-domaine`.
3. Dans Supabase → Authentication → URL Configuration, mets ton domaine comme Site URL et ajoute `https://ton-domaine/auth/callback`.
4. Supabase envoie les e-mails avec un service limité : en production, configure un SMTP (Authentication → SMTP).

## 7. Animations

Les animations suivent le réglage système « réduire les animations ». Les vidéos de `public/media/` (générées avec Higgsfield) sont remplaçables depuis l'admin (vidéo d'un cours ou d'un chapitre). Les fichiers sources sont dans `media-src/`.
