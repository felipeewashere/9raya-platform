import { WelcomeView } from "./view";

export const metadata = { title: "Bienvenue" };

/** After sign-in: save the answers given before the account step (or ask them now). */
export default function WelcomePage() {
  return <WelcomeView />;
}
