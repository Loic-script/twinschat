import type { ReactNode } from "react";
import Link from "next/link";
import {
  Bell,
  BellRing,
  CheckCheck,
  HelpCircle,
  Languages,
  Lightbulb,
  MessagesSquare,
  Paperclip,
  Pencil,
  Pin,
  SmilePlus,
  Smartphone,
  type LucideIcon,
} from "lucide-react";
import { ProjectIcon } from "@/components/brand/project-icon";

/*
 * Guide d'utilisation de l'espace utilisateur : sections numérotées, étapes simples, astuces et FAQ.
 * Mobile : sommaire en onglets défilants en haut ; ordinateur : sommaire fixe sur le côté.
 */

type Step = { title: string; text: ReactNode };
type Section = {
  id: string;
  title: string;
  intro: string;
  steps: Step[];
  tip?: ReactNode;
  action?: { href: string; label: string };
};

/** Touche de clavier. */
const Kbd = ({ children }: { children: ReactNode }) => (
  <kbd className="rounded-md border border-border bg-surface-2/80 px-1.5 py-0.5 font-sans text-[12px] font-medium text-foreground">
    {children}
  </kbd>
);

/** Bouton de l'application cité dans le texte (avec son icône). */
const Btn = ({ icon: Icon, label }: { icon: LucideIcon; label: string }) => (
  <span className="inline-flex items-center gap-1 rounded-md bg-surface-2/80 px-1.5 py-0.5 align-middle text-[13px] font-medium text-foreground">
    <Icon className="size-3.5 text-accent-strong" aria-hidden /> {label}
  </span>
);

const SECTIONS: Section[] = [
  {
    id: "premiers-pas",
    title: "Premiers pas",
    intro:
      "TwinsChat vous met en relation avec l'équipe Twins Dev : vous discutez, proposez vos projets et retrouvez vos fichiers au même endroit.",
    steps: [
      {
        title: "Repérez les rubriques",
        text: (
          <>
            Sur ordinateur, le menu est à gauche ; sur téléphone, il est en bas de l&apos;écran : <b>Messages</b>,{" "}
            <b>Projets</b>, <b>Ressources</b>, <b>Notifications</b> et <b>Profil</b>.
          </>
        ),
      },
      {
        title: "Suivez le point vert",
        text: "Un point vert sur une rubrique signale une nouveauté (nouveau message, projet mis à jour, fichier partagé). Il disparaît dès que vous ouvrez la rubrique.",
      },
      {
        title: "Écrivez votre premier message",
        text: "Ouvrez Messages, puis la discussion « Twins Dev » : c'est votre lien direct avec l'administration.",
      },
    ],
    action: { href: "/user/messages", label: "Ouvrir mes messages" },
  },
  {
    id: "messages",
    title: "Messages",
    intro:
      "Chaque discussion regroupe vos échanges avec l'équipe : la discussion avec l'administration et une discussion par projet.",
    steps: [
      {
        title: "Ouvrir une discussion",
        text: "Dans Messages, touchez « Twins Dev » (administration) ou le nom d'un projet. Sur téléphone, la flèche en haut à gauche ramène à la liste.",
      },
      {
        title: "Envoyer un message",
        text: (
          <>
            Écrivez en bas de l&apos;écran puis appuyez sur <Kbd>Entrée</Kbd> (ou sur le bouton vert). Pour aller à la ligne :{" "}
            <Kbd>Maj</Kbd> + <Kbd>Entrée</Kbd>.
          </>
        ),
      },
      {
        title: "Joindre un fichier ou un lien",
        text: (
          <>
            Touchez <Btn icon={Paperclip} label="trombone" /> pour ajouter une photo, une vidéo, un document ou un lien. Sur
            ordinateur, vous pouvez aussi glisser-déposer ou coller un fichier.
          </>
        ),
      },
      {
        title: "Réagir, modifier, épingler",
        text: (
          <>
            Passez sur un message (ou touchez-le) pour afficher ses actions : <Btn icon={SmilePlus} label="réagir" />,{" "}
            <Btn icon={Pencil} label="modifier" /> (vos messages) et <Btn icon={Pin} label="épingler" /> pour le retrouver vite.
          </>
        ),
      },
      {
        title: "Savoir si c'est lu",
        text: (
          <>
            À côté de vos messages : une coche = envoyé ; <Btn icon={CheckCheck} label="deux coches vertes" /> = lu par votre
            interlocuteur.
          </>
        ),
      },
    ],
    tip: "Les messages épinglés se retrouvent d'un clic avec l'icône punaise, en haut de la discussion.",
    action: { href: "/user/messages", label: "Aller aux messages" },
  },
  {
    id: "traduction",
    title: "Traduction",
    intro: "Lisez les messages de l'équipe dans votre langue, d'un simple bouton.",
    steps: [
      {
        title: "Indiquez vos langues",
        text: "Dans Profil, rubrique « Langues », cochez les langues que vous parlez (par exemple français, anglais).",
      },
      {
        title: "Activez la traduction",
        text: (
          <>
            En haut d&apos;une discussion, touchez <Btn icon={Languages} label="Traduire" />, puis activez l&apos;interrupteur.
          </>
        ),
      },
      {
        title: "Choisissez la langue",
        text: "Sélectionnez une de vos langues : les messages reçus sont traduits. Sous chaque message, « Voir l'original » affiche le texte d'origine.",
      },
    ],
    tip: "Pour revenir aux messages d'origine, choisissez « Afficher les messages originaux » ou désactivez l'interrupteur.",
  },
  {
    id: "projets",
    title: "Projets",
    intro: "Proposez vos projets à l'équipe Twins Dev et suivez leur avancement étape par étape.",
    steps: [
      {
        title: "Proposer un projet",
        text: "Dans Projets, touchez « Nouveau projet », donnez un titre, une catégorie (facultatif) et décrivez votre besoin, puis envoyez.",
      },
      {
        title: "Attendre la validation",
        text: "Votre projet est d'abord « Proposé ». L'équipe l'étudie puis le valide : vous recevez une notification.",
      },
      {
        title: "Échanger sur le projet",
        text: "Une fois validé, le projet passe « En cours » et sa discussion s'ouvre dans Messages. L'équipe peut y ajouter d'autres participants.",
      },
      {
        title: "Suivre l'avancement",
        text: "Le projet passe ensuite « Terminé », puis « Payé » une fois le paiement enregistré. Les filtres en haut de la page trient vos projets par étape.",
      },
    ],
    tip: "Dans la discussion d'un projet, le bouton « i » en haut à droite affiche tous ses détails.",
    action: { href: "/user/projets?nouveau=1", label: "Proposer un projet" },
  },
  {
    id: "ressources",
    title: "Ressources",
    intro: "Retrouvez tous les fichiers et liens échangés, et rangez-les dans vos propres dossiers.",
    steps: [
      {
        title: "Retrouver un fichier",
        text: "La recherche en haut trouve un fichier, un lien ou un dossier. « Par type » classe les photos, vidéos, documents et liens.",
      },
      {
        title: "Voir ce qu'on vous a partagé",
        text: "« Partagés avec vous » regroupe les fichiers et liens que l'équipe vous a envoyés.",
      },
      {
        title: "Créer vos dossiers",
        text: "Touchez « Nouveau dossier », nommez-le, puis ajoutez-y des fichiers importés, des liens ou des fichiers déjà échangés dans vos discussions.",
      },
      {
        title: "Ouvrir ou télécharger",
        text: "Chaque élément peut être ouvert, téléchargé, ou retrouvé dans la discussion d'où il vient (« Voir dans la discussion »).",
      },
    ],
    action: { href: "/user/ressources", label: "Voir mes ressources" },
  },
  {
    id: "notifications",
    title: "Notifications",
    intro: "Ne manquez rien : TwinsChat vous prévient des nouveaux messages et de l'avancement de vos projets.",
    steps: [
      {
        title: "Consulter les nouveautés",
        text: (
          <>
            Touchez <Btn icon={Bell} label="la cloche" /> : la liste montre les dernières nouveautés ; un clic ouvre directement
            la page concernée.
          </>
        ),
      },
      {
        title: "Choisir ce qui vous intéresse",
        text: "Dans la cloche, la roue « Préférences » permet d'activer ou non chaque type : messages, projets, ressources.",
      },
      {
        title: "Être prévenu sur votre appareil",
        text: (
          <>
            Toujours dans les préférences, activez <Btn icon={BellRing} label="Notifications push" /> puis acceptez la demande
            du navigateur : un son (et une vibration sur Android) vous prévient, même application fermée.
          </>
        ),
      },
    ],
    tip: "Les notifications push se règlent appareil par appareil : activez-les sur votre téléphone et sur votre ordinateur.",
  },
  {
    id: "profil",
    title: "Profil",
    intro: "Présentez-vous à l'équipe et gardez vos informations à jour.",
    steps: [
      {
        title: "Ajouter une photo",
        text: "Dans Profil, touchez votre photo pour la changer ; la photo de couverture se modifie de la même façon.",
      },
      {
        title: "Compléter vos informations",
        text: "Nom, téléphone, entreprise, poste, pays, ville, langues et présentation : modifiez puis touchez « Enregistrer ».",
      },
      {
        title: "Sécuriser votre compte",
        text: "La rubrique « Mot de passe » permet de le changer à tout moment. « Se déconnecter » est en bas de la page.",
      },
    ],
    action: { href: "/user/profil", label: "Ouvrir mon profil" },
  },
];

const INSTALL: { title: string; text: string }[] = [
  { title: "Android (Chrome)", text: "Menu ⋮ en haut à droite, puis « Installer l'application » (ou « Ajouter à l'écran d'accueil »)." },
  {
    title: "iPhone / iPad (Safari)",
    text: "Bouton Partager, puis « Sur l'écran d'accueil ». Ouvrez ensuite TwinsChat depuis l'icône pour activer les notifications.",
  },
  { title: "Ordinateur (Chrome, Edge)", text: "Icône d'installation à droite de la barre d'adresse, puis « Installer »." },
];

const FAQ: { q: string; a: string }[] = [
  {
    q: "Je ne peux pas écrire dans la discussion de mon projet.",
    a: "Un projet « Proposé » attend la validation de l'équipe : sa discussion s'ouvre dès qu'il est validé. En attendant, écrivez à l'administration.",
  },
  {
    q: "Je ne reçois pas de notifications sur mon téléphone.",
    a: "Activez « Notifications push » dans la cloche (Préférences) sur ce téléphone et autorisez les notifications. Sur iPhone, installez d'abord l'application sur l'écran d'accueil.",
  },
  {
    q: "Comment modifier ou supprimer un message ?",
    a: "Passez sur votre message (ou touchez-le) : le crayon permet de le modifier, la corbeille de le supprimer.",
  },
  {
    q: "Le bouton « Traduire » ne propose aucune langue.",
    a: "Ajoutez vos langues dans Profil > Langues, puis activez l'interrupteur du menu « Traduire ».",
  },
  {
    q: "Comment changer mon mot de passe ?",
    a: "Dans Profil, rubrique « Mot de passe » : saisissez l'actuel puis le nouveau. Si vous vous connectez avec Google, utilisez « Continuer avec Google ».",
  },
];

/** Guide complet de l'espace utilisateur. `welcome` : premier accès, juste après le formulaire d'accueil. */
export function UserGuide({ welcome, firstName }: { welcome: boolean; firstName: string }) {
  const toc = [...SECTIONS.map((s) => ({ id: s.id, title: s.title })), { id: "installer", title: "Installer" }, { id: "faq", title: "Questions" }];
  return (
    <div className="mx-auto max-w-6xl px-4 pt-6 pb-16 md:px-8 md:pt-8">
      {welcome ? <WelcomeHero firstName={firstName} /> : <Header />}

      {/* Sommaire mobile et tablette : onglets défilants, toujours visibles en haut */}
      <nav
        aria-label="Sommaire du guide"
        className="sticky top-0 z-10 -mx-4 mt-6 border-b border-border/60 bg-background/85 px-4 py-3 backdrop-blur-md md:-mx-8 md:px-8 xl:hidden"
      >
        <ul className="scroll-thin flex gap-2 overflow-x-auto pb-1">
          {toc.map((s) => (
            <li key={s.id} className="shrink-0">
              <a
                href={`#${s.id}`}
                className="inline-flex h-9 items-center rounded-full border border-border bg-surface-2/50 px-3.5 text-sm font-medium whitespace-nowrap text-foreground/85 hover:border-accent/50 hover:text-accent-strong"
              >
                {s.title}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <div className="mt-6 xl:mt-10 xl:grid xl:grid-cols-[220px_1fr] xl:gap-10">
        {/* Sommaire ordinateur : fixe sur le côté */}
        <nav aria-label="Sommaire du guide" className="hidden xl:block">
          <div className="sticky top-8">
            <p className="mb-3 text-xs font-medium tracking-wide text-muted uppercase">Sommaire</p>
            <ol className="space-y-1">
              {SECTIONS.map((s, i) => (
                <li key={s.id}>
                  <a
                    href={`#${s.id}`}
                    className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-foreground/80 transition-colors hover:bg-surface-2/70 hover:text-accent-strong"
                  >
                    <span className="inline-flex size-6 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-xs font-semibold text-accent-strong">
                      {i + 1}
                    </span>
                    {s.title}
                  </a>
                </li>
              ))}
              <li>
                <a
                  href="#installer"
                  className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-foreground/80 hover:bg-surface-2/70 hover:text-accent-strong"
                >
                  <Smartphone className="size-4 text-muted" /> Installer l&apos;application
                </a>
              </li>
              <li>
                <a
                  href="#faq"
                  className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-foreground/80 hover:bg-surface-2/70 hover:text-accent-strong"
                >
                  <HelpCircle className="size-4 text-muted" /> Questions fréquentes
                </a>
              </li>
            </ol>
          </div>
        </nav>

        <div className="min-w-0 space-y-6">
          {SECTIONS.map((s, i) => (
            <GuideSection key={s.id} section={s} index={i + 1} />
          ))}
          <InstallSection />
          <FaqSection />
          <p className="pt-2 text-center text-sm text-muted">
            Une question qui n&apos;est pas ici ?{" "}
            <Link href="/user/messages" className="font-medium text-accent-strong hover:underline">
              Écrivez à l&apos;équipe Twins Dev
            </Link>
            .
          </p>
        </div>
      </div>
    </div>
  );
}

function Header() {
  return (
    <header className="flex items-start gap-4">
      <div>
        <h1 className="text-[26px] font-semibold tracking-tight md:text-[28px]">Guide d&apos;utilisation</h1>
        <p className="mt-1 max-w-2xl text-muted">
          Tout ce qu&apos;il faut savoir pour utiliser TwinsChat, étape par étape. Touchez une rubrique pour y aller directement.
        </p>
      </div>
    </header>
  );
}

/** Premier accès : bienvenue et trois premiers pas. */
function WelcomeHero({ firstName }: { firstName: string }) {
  const firstSteps = [
    { icon: MessagesSquare, title: "Dites bonjour à l'équipe", text: "Écrivez votre premier message à Twins Dev.", href: "/user/messages" },
    { icon: ProjectIcon, title: "Proposez un projet", text: "Décrivez votre besoin : l'équipe l'étudie.", href: "/user/projets?nouveau=1" },
    { icon: BellRing, title: "Activez les notifications", text: "Cloche > Préférences > Notifications push.", href: "#notifications" },
  ];
  return (
    <section
      aria-labelledby="bienvenue-titre"
      className="relative overflow-hidden rounded-[28px] border border-accent/30 bg-gradient-to-br from-accent/[0.14] via-surface-2/40 to-surface-2/20 p-6 motion-safe:animate-auth-in md:p-8"
    >
      <span aria-hidden className="pointer-events-none absolute -top-20 -right-16 size-64 rounded-full bg-accent/20 blur-3xl" />
      <p className="relative text-sm font-semibold tracking-wide text-accent-strong uppercase">Votre compte est prêt 🎉</p>
      <h1 id="bienvenue-titre" className="relative mt-2 text-[26px] font-semibold tracking-tight md:text-[32px]">
        Bienvenue sur TwinsChat{firstName ? `, ${firstName}` : ""} !
      </h1>
      <p className="relative mt-2 max-w-2xl text-foreground/80">
        Voici un petit guide pour bien démarrer. Commencez par ces trois étapes, puis parcourez les rubriques ci-dessous à votre
        rythme : ce guide reste disponible à tout moment.
      </p>
      <ol className="relative mt-6 grid gap-3 sm:grid-cols-3">
        {firstSteps.map((s, i) => (
          <li key={s.title}>
            <Link
              href={s.href}
              className="group flex h-full items-start gap-3 rounded-2xl border border-border/70 bg-background/50 p-4 transition hover:border-accent/50 hover:bg-background/70"
            >
              <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl bg-accent text-sm font-bold text-[#03140a]">
                {i + 1}
              </span>
              <span className="min-w-0">
                <span className="flex items-center gap-1.5 font-semibold group-hover:text-accent-strong">
                  <s.icon className="size-4 shrink-0" aria-hidden /> {s.title}
                </span>
                <span className="mt-0.5 block text-sm text-muted">{s.text}</span>
              </span>
            </Link>
          </li>
        ))}
      </ol>
      <div className="relative mt-6 flex flex-wrap gap-3">
        <Link
          href="/user/messages"
          className="inline-flex h-11 items-center gap-2 rounded-xl bg-accent px-5 text-sm font-semibold text-[#03140a] shadow-lg shadow-accent/20 hover:bg-accent-strong"
        >
          Commencer <span aria-hidden>→</span>
        </Link>
        <a href="#premiers-pas" className="inline-flex h-11 items-center rounded-xl border border-border px-4 text-sm font-medium hover:bg-surface-2">
          Lire le guide
        </a>
      </div>
    </section>
  );
}

const sectionCard = "scroll-mt-20 rounded-[24px] border border-border/60 bg-surface-2/35 p-5 md:p-7 xl:scroll-mt-8";

function SectionHeading({ id, title, intro, kicker }: { id: string; title: string; intro: string; kicker?: string }) {
  return (
    <div>
      <div className="min-w-0">
        {kicker && <p className="text-xs font-medium tracking-wide text-muted uppercase">{kicker}</p>}
        <h2 id={`${id}-titre`} className="text-xl font-semibold tracking-tight">
          {title}
        </h2>
        <p className="mt-1 text-[15px] text-muted">{intro}</p>
      </div>
    </div>
  );
}

function GuideSection({ section: s, index }: { section: Section; index: number }) {
  return (
    <section id={s.id} aria-labelledby={`${s.id}-titre`} className={sectionCard}>
      <SectionHeading id={s.id} title={s.title} intro={s.intro} kicker={`Étape ${index}`} />

      <ol className="mt-5 space-y-3">
        {s.steps.map((step, i) => (
          <li key={step.title} className="flex gap-3.5 rounded-2xl bg-background/35 p-4">
            <span
              aria-hidden
              className="inline-flex size-7 shrink-0 items-center justify-center rounded-full border border-accent/40 text-sm font-semibold text-accent-strong"
            >
              {i + 1}
            </span>
            <div className="min-w-0">
              <h3 className="font-medium">{step.title}</h3>
              <p className="mt-1 text-[15px] leading-relaxed text-foreground/75">{step.text}</p>
            </div>
          </li>
        ))}
      </ol>

      {(s.tip || s.action) && (
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
          {s.tip && (
            <p className="flex flex-1 items-start gap-2 rounded-xl border border-accent/25 bg-accent/[0.06] px-3.5 py-2.5 text-sm text-foreground/80">
              <Lightbulb className="mt-0.5 size-4 shrink-0 text-accent-strong" aria-hidden />
              <span>
                <b className="font-semibold text-foreground">Astuce : </b>
                {s.tip}
              </span>
            </p>
          )}
          {s.action && (
            <Link
              href={s.action.href}
              className="inline-flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-xl border border-border px-4 text-sm font-medium hover:border-accent/50 hover:text-accent-strong"
            >
              {s.action.label} <span aria-hidden>→</span>
            </Link>
          )}
        </div>
      )}
    </section>
  );
}

function InstallSection() {
  return (
    <section id="installer" aria-labelledby="installer-titre" className={sectionCard}>
      <SectionHeading
        id="installer"
        title="Installer l'application"
        intro="Ajoutez TwinsChat à votre écran d'accueil : il s'ouvre comme une application, en plein écran."
      />
      <ul className="mt-5 grid gap-3 md:grid-cols-3">
        {INSTALL.map((d) => (
          <li key={d.title} className="rounded-2xl bg-background/35 p-4">
            <h3 className="flex items-center gap-2 font-medium">
              <Smartphone className="size-4 text-accent-strong" aria-hidden /> {d.title}
            </h3>
            <p className="mt-1.5 text-sm leading-relaxed text-foreground/75">{d.text}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

function FaqSection() {
  return (
    <section id="faq" aria-labelledby="faq-titre" className={sectionCard}>
      <SectionHeading id="faq" title="Questions fréquentes" intro="Touchez une question pour afficher la réponse." />
      <div className="mt-5 space-y-2">
        {FAQ.map((f) => (
          <details key={f.q} className="group rounded-2xl bg-background/35 open:bg-background/50">
            <summary className="flex cursor-pointer list-none items-center gap-3 rounded-2xl px-4 py-3.5 font-medium hover:text-accent-strong [&::-webkit-details-marker]:hidden">
              <span className="min-w-0 flex-1">{f.q}</span>
              <span
                aria-hidden
                className="inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-surface-2 text-muted transition-transform group-open:rotate-45"
              >
                +
              </span>
            </summary>
            <p className="px-4 pb-4 text-[15px] leading-relaxed text-foreground/75">{f.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
