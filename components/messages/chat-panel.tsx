"use client";

import Link from "next/link";
import {
  Fragment,
  useEffect,
  useLayoutEffect,
  useOptimistic,
  useRef,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import {
  ArrowLeft,
  Check,
  CheckCheck,
  Info,
  Clock3,
  Languages,
  Loader2,
  Pin,
  Pencil,
  PinOff,
  SmilePlus,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { deleteMessage, editMessage, markAsRead, toggleReaction, togglePin } from "@/lib/actions/messages";
import { draftReplyWithMistral } from "@/lib/actions/assistant";
import { translateMessages } from "@/lib/actions/translate";
import { BrowserTranslationError, browserTranslationSupported, translateInBrowser, warmUp, type BrowserTranslation } from "@/components/messages/browser-translator";
import { Composer } from "@/components/messages/composer";
import { LinkPreview, MessageAttachments } from "@/components/messages/message-attachments";
import { Avatar } from "@/components/ui/avatar";
import { RoleBadge } from "@/components/messages/role-badge";
import { dayKey, displayName, formatDayChip, formatPresence, formatTime } from "@/lib/format";
import { languageName } from "@/lib/languages";
import { REACTION_EMOJIS, type ConversationSummary, type Message, type Space } from "@/lib/types";

type UiMessage = Message & { pending?: boolean };
type Group = { key: string; mine: boolean; newDay: boolean; messages: UiMessage[] };
/** Traduction reçue, avec le texte d'origine traduit (pour refaire la traduction si le message change). */
type CachedTranslation = BrowserTranslation & { src: string };

/** Messages envoyés au serveur par appel de traduction. */
const SERVER_CHUNK = 40;


const GROUP_GAP_MS = 5 * 60_000;

export const headerButton =
  "relative inline-flex size-12 items-center justify-center rounded-2xl bg-surface-2/70 text-foreground/90 transition-colors hover:bg-surface-2 hover:text-accent-strong disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-surface-2/70 disabled:hover:text-foreground/90";

/** Regroupe les messages consécutifs d'un même expéditeur (même jour, moins de 5 min d'écart). */
function groupMessages(messages: UiMessage[], meId: string): Group[] {
  const groups: Group[] = [];
  for (const m of messages) {
    const last = groups.at(-1);
    const prev = last?.messages.at(-1);
    const sameDay = prev && dayKey(prev.createdAt) === dayKey(m.createdAt);
    if (
      last &&
      prev &&
      sameDay &&
      prev.senderId === m.senderId &&
      +new Date(m.createdAt) - +new Date(prev.createdAt) < GROUP_GAP_MS
    ) {
      last.messages.push(m);
    } else {
      groups.push({ key: m.id, mine: m.senderId === meId, newDay: !sameDay, messages: [m] });
    }
  }
  return groups;
}

const URL_RE = /((?:https?:\/\/|www\.)[^\s<]+[^\s<.,;:!?)\]'"])/gi;

/** Rend les liens cliquables sans jamais injecter de HTML. */
function linkify(text: string, mine: boolean): ReactNode[] {
  return text.split(URL_RE).map((part, i) => {
    if (i % 2 === 0) return part;
    const href = part.startsWith("http") ? part : `https://${part}`;
    return (
      <a
        key={i}
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={`underline underline-offset-2 ${mine ? "font-semibold" : "text-accent-strong"}`}
      >
        {part}
      </a>
    );
  });
}

export function ChatPanel({
  conversation,
  messages,
  meId,
  meName,
  meAvatarUrl = null,
  heading,
  avatar,
  details,
  headerActions,
  backHref = "/admin/messages",
  canModerate = true,
  space,
  composerPlaceholder,
  locked,
  translate,
  assistant = false,
}: {
  conversation: ConversationSummary;
  messages: Message[];
  /** Compte connecté (ses messages sont à droite, « Vous »). */
  meId: string;
  meName: string;
  /** Photo du compte connecté (à côté de « Vous »). */
  meAvatarUrl?: string | null;
  /** Remplace le titre de l'en-tête (ex. nom du projet, avec l'auteur en dessous). */
  heading?: { title: string; badge?: ReactNode; subtitle: ReactNode };
  /** Remplace l'avatar de l'en-tête (ex. icône du projet). */
  avatar?: ReactNode;
  /** Détails consultables via le bouton « i » de l'en-tête (volet latéral). */
  details?: { label: string; content: ReactNode };
  /** Boutons supplémentaires dans l'en-tête (ex. « + » pour ajouter des participants). */
  headerActions?: ReactNode;
  /** Lien du bouton retour sur mobile. */
  backHref?: string;
  /** Peut supprimer les messages des autres (admin) ; sinon seulement les siens. */
  canModerate?: boolean;
  /** Espace de la page (admin ou user) : désigne le compte qui agit. */
  space: Space;
  composerPlaceholder?: string;
  /** Discussion fermée (ex. projet en attente de validation) : ce contenu remplace la zone de saisie. */
  locked?: ReactNode;
  /** Bouton « Traduire » : activé ou non (profil), et langues proposées (messages reçus traduits dans l'une d'elles). */
  translate?: { enabled: boolean; languages: string[]; server: boolean };
  /** Admin, Mistral configuré : bouton « Répondre avec Mistral » sur les messages reçus (brouillon à relire). */
  assistant?: boolean;
}) {
  const { contact } = conversation;
  const [showDetails, setShowDetails] = useState(false);
  const [optimistic, addOptimistic] = useOptimistic<UiMessage[], UiMessage>(
    messages,
    (state, msg) => [...state, msg],
  );
  const [error, setError] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [showPinned, setShowPinned] = useState(false);
  const [, startTransition] = useTransition();

  // Traduction des messages reçus : langue choisie (mémorisée sur cet appareil) et traductions obtenues
  const langKey = `twinschat:traduction:${meId}`;
  const [lang, setLang] = useState<string | null>(null);
  const [translations, setTranslations] = useState<Record<string, Record<string, CachedTranslation>>>({});
  const [translating, setTranslating] = useState(false);
  const [originals, setOriginals] = useState<Set<string>>(() => new Set());
  const requested = useRef(new Set<string>());

  // Réponse proposée par Mistral : placée dans la zone de saisie, jamais envoyée automatiquement
  const [injected, setInjected] = useState<{ id: number; text: string } | null>(null);
  const [draftingId, setDraftingId] = useState<string | null>(null);

  async function draftReply(messageId: string) {
    if (draftingId) return;
    setError(null);
    setDraftingId(messageId);
    try {
      const res = await draftReplyWithMistral(conversation.id, messageId);
      if (res.ok) setInjected({ id: Date.now(), text: res.draft });
      else setError(res.error);
    } catch {
      setError("La rédaction avec Mistral a échoué.");
    } finally {
      setDraftingId(null);
    }
  }

  useEffect(() => {
    try {
      const saved = localStorage.getItem(langKey);
      if (saved && translate?.enabled && translate.languages.includes(saved)) setLang(saved);
    } catch {
      /* stockage indisponible : pas de langue mémorisée */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- uniquement à l'ouverture
  }, []);

  function chooseLanguage(next: string | null) {
    // Dans le clic : le navigateur peut télécharger le modèle de détection de langue
    if (next && !translate?.server) warmUp();
    setLang(next);
    setOriginals(new Set());
    if (next) setError(null);
    try {
      if (next) localStorage.setItem(langKey, next);
      else localStorage.removeItem(langKey);
    } catch {
      /* stockage indisponible */
    }
  }

  const scrollRef = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);
  const contentRef = useRef<HTMLDivElement>(null);

  // Les images et vidéos agrandissent le fil en se chargeant : on reste en bas si on y était.
  useEffect(() => {
    const content = contentRef.current;
    const scroller = scrollRef.current;
    if (!content || !scroller || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => {
      if (stickToBottom.current) scroller.scrollTop = scroller.scrollHeight;
    });
    observer.observe(content);
    return () => observer.disconnect();
  }, []);

  // Arrivée sur la conversation : on se place en bas, ou sur le message visé par l'ancre
  // (#msg-…, utilisée par la page Ressources pour « Voir dans la discussion »).
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const target = window.location.hash.slice(1);
    if (target.startsWith("msg-") && document.getElementById(target)) {
      stickToBottom.current = false;
      jumpTo(target.slice(4));
      return;
    }
    el.scrollTop = el.scrollHeight;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- uniquement à l'ouverture
  }, []);

  // Nouveau message : on suit le bas seulement si l'utilisateur y était déjà.
  useEffect(() => {
    const el = scrollRef.current;
    if (el && stickToBottom.current) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [optimistic.length]);

  // Marque la conversation comme lue quand de nouveaux messages arrivent.
  const lastIncomingId = optimistic.findLast((m) => m.senderId !== meId)?.id;
  useEffect(() => {
    if (lastIncomingId) void markAsRead(space, conversation.id);
  }, [space, conversation.id, lastIncomingId]);

  // Langue choisie : traduit les messages reçus pas encore traduits (les plus récents d'abord).
  // Le serveur (IA Mistral) d'abord ; s'il est indisponible (pas de clé, quota atteint), le navigateur prend le relais.
  useEffect(() => {
    if (!lang || !translate?.enabled) return;
    const keyOf = (m: UiMessage) => `${lang}:${m.id}:${m.body}`;
    const todo = optimistic
      .filter((m) => m.senderId !== meId && !m.deleted && !m.pending && m.body.trim())
      .filter((m) => !requested.current.has(keyOf(m)))
      .reverse();
    if (todo.length === 0) return;
    todo.forEach((m) => requested.current.add(keyOf(m)));

    const save = (m: UiMessage, t: BrowserTranslation) =>
      setTranslations((all) => ({ ...all, [lang]: { ...all[lang], [m.id]: { ...t, src: m.body } } }));
    // Échec définitif : on oublie ces demandes (nouvel essai en choisissant de nouveau la langue)
    const fail = (rest: UiMessage[], message: string) => {
      rest.forEach((m) => requested.current.delete(keyOf(m)));
      setError(message);
      setLang((current) => (current === lang ? null : current));
    };

    setTranslating(true);
    void (async () => {
      let rest = todo;
      if (translate.server) {
        while (rest.length > 0) {
          const chunk = rest.slice(0, SERVER_CHUNK);
          const res = await translateMessages(space, conversation.id, chunk.map((m) => m.id), lang).catch(() => null);
          if (res?.ok) {
            chunk.forEach((m) => res.translations[m.id] && save(m, res.translations[m.id]));
            rest = rest.slice(SERVER_CHUNK);
            continue;
          }
          if (res && !res.fallback) {
            fail(rest, res.error);
            setTranslating(false);
            return;
          }
          break; // Mistral indisponible : le navigateur traduit le reste
        }
      }
      if (rest.length > 0 && !browserTranslationSupported()) {
        fail(
          rest,
          translate.server
            ? "La traduction est momentanément indisponible. Réessayez plus tard."
            : "La traduction nécessite Chrome sur ordinateur (version 138 ou plus récente).",
        );
        setTranslating(false);
        return;
      }
      for (const [i, m] of rest.entries()) {
        try {
          save(m, await translateInBrowser(m.body, lang));
        } catch (err) {
          // Langue d'origine non prise en charge : ce message reste tel quel
          if (err instanceof BrowserTranslationError && err.message === "pair-unavailable") continue;
          fail(rest.slice(i), "Le modèle de traduction n'a pas pu être préparé. Choisissez de nouveau la langue pour réessayer.");
          break;
        }
      }
      setTranslating(false);
    })();
  }, [lang, optimistic, meId, space, conversation.id, translate?.enabled, translate?.server]);

  // Traduction désactivée dans le profil : on revient aux messages originaux
  const activeLang = translate?.enabled ? lang : null;

  const pinned = optimistic.filter((m) => m.pinned && !m.deleted);
  const groups = groupMessages(optimistic, meId);
  const contactReadAt = conversation.contactLastReadAt ? +new Date(conversation.contactLastReadAt) : 0;

  function runAction(action: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    startTransition(async () => {
      const res = await action();
      if (!res.ok) setError(res.error ?? "Action impossible.");
    });
  }

  function jumpTo(id: string) {
    const el = document.getElementById(`msg-${id}`);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    const bubble = el.querySelector("[data-bubble]") as HTMLElement | null;
    bubble?.classList.remove("flash");
    void bubble?.offsetWidth; // relance l'animation
    bubble?.classList.add("flash");
  }

  return (
    <div className="relative flex h-full min-h-0">
    <section aria-label={`Discussion avec ${contact.name}`} className="flex h-full min-h-0 min-w-0 flex-1 flex-col">
      {/* En-tête */}
      <header className="flex items-center gap-4 border-b border-border/60 px-4 py-4 md:px-8 md:py-5">
        <Link
          href={backHref}
          className="-ml-1 inline-flex size-10 items-center justify-center rounded-xl text-muted hover:bg-surface-2 md:hidden"
          aria-label="Retour aux discussions"
        >
          <ArrowLeft className="size-5" />
        </Link>
        {avatar ?? <Avatar name={displayName(contact)} src={contact.avatarUrl} status={contact.status} size="xl" />}
        {heading ? (
          <div className="min-w-0 flex-1 overflow-hidden">
            <div className="flex min-w-0 items-center gap-2.5">
              <h2 className="min-w-0 truncate text-xl font-semibold">{heading.title}</h2>
              {heading.badge}
            </div>
            <p className="mt-0.5 truncate text-sm text-muted" suppressHydrationWarning>
              {heading.subtitle}
            </p>
          </div>
        ) : (
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2.5">
              <h2 className="truncate text-xl font-semibold">
                <Link
                  href={`/admin/utilisateurs/${contact.id}`}
                  className="rounded-md hover:text-accent-strong hover:underline"
                  title="Voir le profil"
                >
                  {displayName(contact)}
                </Link>
              </h2>
              <RoleBadge role={contact.role} />
            </div>
            <p className="mt-0.5 truncate text-sm text-muted" suppressHydrationWarning>
              <span className={contact.status === "en_ligne" ? "font-medium text-accent-strong" : undefined}>
                {formatPresence(contact.status, contact.lastSeenAt)}
              </span>
              {contact.role === "entreprise" ? <> · {contact.name}</> : contact.company && <> · {contact.company}</>}
              <span className="hidden lg:inline"> · {contact.email}</span>
            </p>
          </div>
        )}
        <div className="flex items-center gap-2 md:gap-3">
          <button
            type="button"
            onClick={() => setShowPinned((v) => !v)}
            disabled={pinned.length === 0}
            aria-expanded={showPinned}
            aria-controls="pinned-list"
            aria-label={`Messages épinglés (${pinned.length})`}
            title="Messages épinglés"
            className={`${headerButton} ${showPinned ? "bg-accent/15 text-accent-strong" : ""}`}
          >
            <Pin className="size-5" />
            {pinned.length > 0 && (
              <span className="absolute -top-1 -right-1 inline-flex size-5 items-center justify-center rounded-full bg-accent text-[11px] font-semibold text-background">
                {pinned.length}
              </span>
            )}
          </button>
          {translate && (
            <TranslateMenu
              languages={translate.languages}
              enabled={translate.enabled}
              server={translate.server}
              settingsHref={space === "admin" ? "/admin/profil" : "/user/profil"}
              value={activeLang}
              busy={translating}
              onChange={chooseLanguage}
            />
          )}
          {headerActions}
          {details && (
            <button
              type="button"
              onClick={() => setShowDetails((v) => !v)}
              aria-expanded={showDetails}
              aria-controls="chat-details"
              aria-label={details.label}
              title={details.label}
              className={`${headerButton} ${showDetails ? "bg-accent/15 text-accent-strong" : ""}`}
            >
              <Info className="size-5" />
            </button>
          )}
        </div>
      </header>

      {showPinned && pinned.length > 0 && (
        <ul id="pinned-list" className="scroll-thin max-h-44 space-y-1 overflow-y-auto border-b border-border/60 bg-background/30 px-4 py-3 md:px-8">
          {pinned.map((m) => (
            <li key={m.id}>
              <button
                type="button"
                onClick={() => jumpTo(m.id)}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm hover:bg-surface-2/70"
              >
                <Pin className="size-3.5 shrink-0 text-accent-strong" />
                <span className="truncate">{m.body || "Pièce jointe"}</span>
                <span className="ml-auto shrink-0 text-xs text-muted" suppressHydrationWarning>
                  {formatTime(m.createdAt)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Fil de discussion */}
      <div
        ref={scrollRef}
        onScroll={(e) => {
          const el = e.currentTarget;
          stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
        }}
        className="scroll-thin min-h-0 flex-1 overflow-y-auto px-4 pt-2 pb-6 md:px-8"
      >
        <div ref={contentRef}>
        {groups.length === 0 && !locked && (
          <p className="mt-20 text-center text-sm text-muted">
            Aucun message pour l&apos;instant. Écrivez le premier !
          </p>
        )}
        {groups.map((g) => {
          const first = g.messages[0];
          const last = g.messages.at(-1)!;
          const pending = g.messages.some((m) => m.pending);
          const read = !pending && +new Date(last.createdAt) <= contactReadAt;
          return (
            <Fragment key={g.key}>
              {g.newDay && (
                <div className="my-6 flex justify-center" role="separator">
                  <span
                    className="rounded-xl bg-accent/10 px-4 py-2 text-sm font-medium text-accent-strong"
                    suppressHydrationWarning
                  >
                    {formatDayChip(first.createdAt)}
                  </span>
                </div>
              )}
              <div className={`mt-6 flex flex-col ${g.mine ? "items-end" : "items-start"}`}>
                {/* En-tête du groupe */}
                {g.mine ? (
                  <div className="mb-2.5 flex items-center gap-2 text-sm text-muted">
                    {pending ? (
                      <Clock3 className="size-4" aria-label="Envoi en cours" />
                    ) : read ? (
                      <CheckCheck className="size-[18px] text-accent-strong" aria-label="Lu" />
                    ) : (
                      <Check className="size-4" aria-label="Envoyé" />
                    )}
                    <time dateTime={first.createdAt} suppressHydrationWarning>
                      {pending ? "Envoi…" : formatTime(first.createdAt)}
                    </time>
                    <span aria-hidden>•</span>
                    <span className="font-medium text-foreground">Vous</span>
                    <Avatar name={meName} src={meAvatarUrl} size="sm" />
                  </div>
                ) : (
                  <div className="mb-2.5 flex items-center gap-2 text-sm text-muted">
                    <Avatar name={first.senderName} src={first.senderAvatarUrl} size="sm" />
                    <span className="font-medium text-foreground">{first.senderName.split(" ")[0]}</span>
                    <span aria-hidden>•</span>
                    <time dateTime={first.createdAt} suppressHydrationWarning>
                      {formatTime(first.createdAt)}
                    </time>
                  </div>
                )}

                <ol className={`flex w-full flex-col gap-2 ${g.mine ? "items-end" : "items-start"}`}>
                  {g.messages.map((m) => (
                    <li key={m.id} id={`msg-${m.id}`} className={`flex w-full ${g.mine ? "justify-end" : "justify-start"}`}>
                      <MessageBubble
                        message={m}
                        mine={g.mine}
                        meId={meId}
                        canDelete={g.mine || canModerate}
                        translation={(() => {
                          const t = activeLang && !g.mine ? translations[activeLang]?.[m.id] : undefined;
                          return t && t.src === m.body ? t : undefined;
                        })()}
                        showOriginal={originals.has(m.id)}
                        onDraftReply={assistant && !g.mine && m.body.trim() ? () => void draftReply(m.id) : undefined}
                        drafting={draftingId === m.id}
                        onToggleOriginal={() =>
                          setOriginals((set) => {
                            const next = new Set(set);
                            if (next.has(m.id)) next.delete(m.id);
                            else next.add(m.id);
                            return next;
                          })
                        }
                        confirmingDelete={confirmDeleteId === m.id}
                        onReact={(emoji) => runAction(() => toggleReaction(space, conversation.id, m.id, emoji))}
                        onEdit={(body) => editMessage(space, conversation.id, m.id, body)}
                        onTogglePin={() => runAction(() => togglePin(space, conversation.id, m.id))}
                        onAskDelete={() => setConfirmDeleteId(m.id)}
                        onCancelDelete={() => setConfirmDeleteId(null)}
                        onConfirmDelete={() => {
                          setConfirmDeleteId(null);
                          runAction(() => deleteMessage(space, conversation.id, m.id));
                        }}
                      />
                    </li>
                  ))}
                </ol>
              </div>
            </Fragment>
          );
        })}
        </div>
      </div>

      {/* Erreurs des actions sur les messages (épingler, supprimer) */}
      {error && (
        <p role="alert" className="px-4 pb-2 text-sm text-rose-300 md:px-8">
          {error}
        </p>
      )}

      {/* Zone de saisie : texte, fichiers et liens (ou encart si la discussion est fermée) */}
      {locked ?? (
        <Composer
          space={space}
          conversationId={conversation.id}
          meId={meId}
          meName={meName}
          label={heading ? `Message : ${heading.title}` : `Message à ${contact.name}`}
          placeholder={composerPlaceholder ?? `Écrire un message à ${contact.name.split(" ")[0]}…`}
          addOptimistic={addOptimistic}
          inject={injected}
          onSending={() => {
            setError(null);
            stickToBottom.current = true;
          }}
        />
      )}
    </section>

    {/* Volet de détails : plein écran sur mobile, superposé à droite, puis côte à côte sur très grand écran */}
    {details && showDetails && (
      <aside
        id="chat-details"
        aria-label={details.label}
        className="fixed inset-0 z-40 flex flex-col bg-surface md:absolute md:inset-y-0 md:right-0 md:left-auto md:w-[380px] md:border-l md:border-border/60 md:shadow-2xl md:shadow-black/50 2xl:static 2xl:z-auto 2xl:shrink-0 2xl:shadow-none"
      >
        <div className="flex items-center gap-2 border-b border-border/60 px-6 py-5">
          <h2 className="mr-auto text-lg font-semibold">{details.label}</h2>
          <button
            type="button"
            onClick={() => setShowDetails(false)}
            aria-label="Fermer"
            className="inline-flex size-9 items-center justify-center rounded-xl text-muted hover:bg-surface-2 hover:text-foreground"
          >
            <X className="size-[18px]" />
          </button>
        </div>
        <div className="scroll-thin flex-1 overflow-y-auto">{details.content}</div>
      </aside>
    )}
    </div>
  );
}

function MessageBubble({
  message: m,
  mine,
  meId,
  canDelete,
  confirmingDelete,
  translation,
  showOriginal,
  onToggleOriginal,
  onDraftReply,
  drafting = false,
  onReact,
  onEdit,
  onTogglePin,
  onAskDelete,
  onCancelDelete,
  onConfirmDelete,
}: {
  message: UiMessage;
  mine: boolean;
  meId: string;
  canDelete: boolean;
  confirmingDelete: boolean;
  /** Traduction du message dans la langue choisie (messages reçus). */
  translation?: BrowserTranslation;
  showOriginal: boolean;
  onToggleOriginal: () => void;
  /** Admin : faire rédiger une réponse à ce message par Mistral. */
  onDraftReply?: () => void;
  drafting?: boolean;
  onReact: (emoji: string) => void;
  onEdit: (body: string) => Promise<{ ok: boolean; error?: string }>;
  onTogglePin: () => void;
  onAskDelete: () => void;
  onCancelDelete: () => void;
  onConfirmDelete: () => void;
}) {
  const canAct = !m.deleted && !m.pending;
  // Traduction utile seulement si le texte change (message déjà dans la langue choisie : rien à afficher)
  const translated = !!translation && translation.body.trim() !== m.body.trim();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(m.body);
  const [editError, setEditError] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();
  const [pickerOpen, setPickerOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);
  const iconBtn =
    "inline-flex size-8 items-center justify-center rounded-lg text-muted hover:bg-surface-2 hover:text-foreground";

  // Choix d'emoji : fermeture au clic extérieur ou avec Échap.
  useEffect(() => {
    if (!pickerOpen) return;
    const onPointer = (e: MouseEvent) => !pickerRef.current?.contains(e.target as Node) && setPickerOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setPickerOpen(false);
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [pickerOpen]);

  function startEdit() {
    setDraft(m.body);
    setEditError(null);
    setEditing(true);
  }

  function saveEdit() {
    if (draft.trim() === m.body.trim()) return setEditing(false);
    setEditError(null);
    startSaving(async () => {
      const res = await onEdit(draft);
      if (res.ok) setEditing(false);
      else setEditError(res.error ?? "Modification impossible.");
    });
  }

  function react(emoji: string) {
    setPickerOpen(false);
    onReact(emoji);
  }

  if (editing) {
    return (
      <div className={`flex w-full max-w-[92%] flex-col gap-2 md:max-w-[75%] ${mine ? "items-end" : "items-start"}`}>
        <label htmlFor={`edit-${m.id}`} className="sr-only">
          Modifier le message
        </label>
        <textarea
          id={`edit-${m.id}`}
          autoFocus
          value={draft}
          rows={Math.min(8, Math.max(2, draft.split("\n").length))}
          maxLength={4000}
          onChange={(e) => setDraft(e.target.value)}
          onFocus={(e) => e.currentTarget.setSelectionRange(e.currentTarget.value.length, e.currentTarget.value.length)}
          onKeyDown={(e) => {
            if (e.key === "Escape") setEditing(false);
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              saveEdit();
            }
          }}
          className="w-full min-w-[260px] resize-y rounded-[18px] border border-accent/50 bg-surface-2 px-4 py-3 text-[15px] leading-relaxed text-foreground focus:outline-none"
        />
        <div className="flex items-center gap-2 text-xs">
          {editError && <span className="mr-auto text-rose-300">{editError}</span>}
          <span className="text-muted">Entrée pour enregistrer · Échap pour annuler</span>
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="rounded-lg border border-border px-3 py-1.5 font-medium hover:bg-surface-2"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={saveEdit}
            disabled={saving}
            className="rounded-lg bg-accent px-3 py-1.5 font-semibold text-background hover:bg-accent-strong disabled:opacity-60"
          >
            Enregistrer
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex max-w-[92%] flex-col md:max-w-[75%] ${mine ? "items-end" : "items-start"}`}>
    <div className={`group flex max-w-full items-center gap-1.5 ${mine ? "flex-row-reverse" : ""}`}>
      <div
        data-bubble
        className={`relative rounded-[22px] ${!m.deleted && !m.body && m.attachments.length > 0 ? "p-1.5" : "px-5 py-3.5 md:px-6 md:py-4"} text-[15px] leading-relaxed break-words whitespace-pre-wrap ${
          m.deleted
            ? "border border-dashed border-border text-muted italic"
            : mine
              ? "bg-accent text-background"
              : "bg-surface-2 text-foreground"
        } ${m.pending ? "opacity-70" : ""}`}
      >
        {m.pinned && !m.deleted && (
          <span
            className={`mb-1 flex items-center gap-1 text-xs font-medium ${mine ? "text-background/70" : "text-accent-strong"}`}
          >
            <Pin className="size-3" /> Épinglé
          </span>
        )}
        {m.deleted ? (
          "Message supprimé"
        ) : (
          <>
            {m.attachments.length > 0 && (
              <div className={m.body ? "mb-2.5" : ""}>
                <MessageAttachments attachments={m.attachments} mine={mine} pending={m.pending} />
              </div>
            )}
            {m.body && linkify(translated && !showOriginal ? translation!.body : m.body, mine)}
            {m.editedAt && (
              <span className={`ml-2 text-[11px] whitespace-nowrap ${mine ? "text-background/60" : "text-muted"}`}>
                (modifié)
              </span>
            )}
            {translated && (
              <span className="mt-2 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs whitespace-normal text-muted">
                <Languages className="size-3.5 shrink-0" aria-hidden />
                {showOriginal
                  ? "Message original"
                  : `Traduit${translation!.from ? ` · original en ${languageName(translation!.from).toLocaleLowerCase("fr")}` : ""}`}
                <span aria-hidden>·</span>
                <button type="button" onClick={onToggleOriginal} className="font-medium text-accent-strong hover:underline">
                  {showOriginal ? "Voir la traduction" : "Voir l'original"}
                </button>
              </span>
            )}
            {m.body && <LinkPreview body={m.body} mine={mine} />}
          </>
        )}
      </div>

      {canAct && (
        <div
          className={`relative flex shrink-0 items-center gap-0.5 transition-opacity ${
            confirmingDelete || pickerOpen || drafting ? "opacity-100" : "opacity-0 group-hover:opacity-100 focus-within:opacity-100"
          }`}
        >
          {confirmingDelete ? (
            <span className="flex items-center gap-1 rounded-xl bg-background/60 px-2 py-1 text-sm">
              <span className="text-rose-300">Supprimer ?</span>
              <button type="button" onClick={onConfirmDelete} className={iconBtn} aria-label="Confirmer la suppression">
                <Check className="size-4 text-rose-300" />
              </button>
              <button type="button" onClick={onCancelDelete} className={iconBtn} aria-label="Annuler">
                <X className="size-4" />
              </button>
            </span>
          ) : (
            <>
              {onDraftReply && (
                <button
                  type="button"
                  onClick={onDraftReply}
                  disabled={drafting}
                  className={`${iconBtn} hover:text-accent-strong disabled:cursor-wait ${drafting ? "text-accent-strong" : ""}`}
                  aria-label={drafting ? "Mistral rédige une réponse…" : "Répondre avec Mistral"}
                  title={drafting ? "Mistral rédige une réponse…" : "Répondre avec Mistral"}
                >
                  {drafting ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
                </button>
              )}
              <div ref={pickerRef} className="relative">
                <button
                  type="button"
                  onClick={() => setPickerOpen((v) => !v)}
                  aria-expanded={pickerOpen}
                  aria-haspopup="menu"
                  className={`${iconBtn} ${pickerOpen ? "bg-surface-2 text-foreground" : ""}`}
                  aria-label="Réagir au message"
                  title="Réagir"
                >
                  <SmilePlus className="size-4" />
                </button>
                {pickerOpen && (
                  <div
                    role="menu"
                    aria-label="Choisir une réaction"
                    className={`absolute bottom-full z-20 mb-2 flex gap-0.5 rounded-2xl border border-border bg-surface p-1.5 shadow-2xl shadow-black/60 ${
                      mine ? "right-0" : "left-0"
                    }`}
                  >
                    {REACTION_EMOJIS.map((emoji) => {
                      const chosen = m.reactions.some((r) => r.emoji === emoji && r.userIds.includes(meId));
                      return (
                        <button
                          key={emoji}
                          type="button"
                          role="menuitem"
                          onClick={() => react(emoji)}
                          aria-label={chosen ? `Retirer la réaction ${emoji}` : `Réagir ${emoji}`}
                          className={`inline-flex size-9 items-center justify-center rounded-xl text-lg transition-transform hover:scale-125 hover:bg-surface-2 ${
                            chosen ? "bg-surface-2" : ""
                          }`}
                        >
                          {emoji}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
              {mine && (
                <button
                  type="button"
                  onClick={startEdit}
                  className={iconBtn}
                  aria-label="Modifier le message"
                  title="Modifier"
                >
                  <Pencil className="size-4" />
                </button>
              )}
              <button
                type="button"
                onClick={onTogglePin}
                className={iconBtn}
                aria-label={m.pinned ? "Désépingler le message" : "Épingler le message"}
                title={m.pinned ? "Désépingler" : "Épingler"}
              >
                {m.pinned ? <PinOff className="size-4" /> : <Pin className="size-4" />}
              </button>
              {canDelete && (
                <button
                  type="button"
                  onClick={onAskDelete}
                  className={`${iconBtn} hover:text-rose-300`}
                  aria-label="Supprimer le message"
                  title="Supprimer"
                >
                  <Trash2 className="size-4" />
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>

      {/* Réactions : un clic ajoute ou retire la sienne */}
      {!m.deleted && m.reactions.length > 0 && (
        <ul className="mt-1.5 flex flex-wrap gap-1.5" aria-label="Réactions">
          {m.reactions.map((r) => {
            const chosen = r.userIds.includes(meId);
            return (
              <li key={r.emoji}>
                <button
                  type="button"
                  onClick={() => onReact(r.emoji)}
                  title={r.names.join(", ")}
                  aria-label={`${r.emoji} ${r.userIds.length} : ${r.names.join(", ")}${chosen ? " (cliquer pour retirer votre réaction)" : ""}`}
                  aria-pressed={chosen}
                  className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition-colors ${
                    chosen
                      ? "border-accent/50 bg-accent/10 text-foreground"
                      : "border-border bg-surface-2/60 text-foreground/85 hover:border-foreground/25"
                  }`}
                >
                  <span className="text-sm leading-none">{r.emoji}</span>
                  <span className="font-medium tabular-nums">{r.userIds.length}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/** Bouton « Traduire » de l'en-tête : choix d'une des langues du profil, ou retour aux originaux. */
function TranslateMenu({
  languages,
  enabled,
  server,
  settingsHref,
  value,
  busy,
  onChange,
}: {
  languages: string[];
  /** Désactivée dans le profil : le menu propose seulement de l'activer. */
  enabled: boolean;
  /** Le serveur (Mistral) traduit : peu importe le navigateur. */
  server: boolean;
  settingsHref: string;
  value: string | null;
  busy: boolean;
  onChange: (lang: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  // Vérifié après le premier rendu (l'API n'existe que dans le navigateur)
  const [supported, setSupported] = useState(true);
  useEffect(() => setSupported(browserTranslationSupported()), []);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const pick = (lang: string | null) => {
    onChange(lang);
    setOpen(false);
  };
  const item = "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-colors hover:bg-surface-2";

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={value ? `Traduction : ${languageName(value)}` : "Traduire les messages"}
        title={value ? `Traduction : ${languageName(value)}` : "Traduire"}
        className={`${headerButton} ${value || open ? "bg-accent/15 text-accent-strong" : ""}`}
      >
        {busy ? <Loader2 className="size-5 animate-spin" /> : <Languages className="size-5" />}
        {value && (
          <span className="absolute -top-1 -right-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold text-background uppercase">
            {value}
          </span>
        )}
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Traduire les messages"
          className="absolute top-full right-0 z-30 mt-2 w-64 origin-top-right rounded-2xl border border-border bg-surface p-1.5 shadow-2xl shadow-black/60 motion-safe:animate-select-in"
        >
          <p className="px-3 pt-2 pb-1.5 text-[11px] font-medium tracking-wide text-muted uppercase">Traduire les messages en</p>
          {!enabled ? (
            <p className="px-3 py-2 text-sm text-muted">
              La traduction est désactivée. Activez-la dans votre profil.
            </p>
          ) : !server && !supported ? (
            <p className="px-3 py-2 text-sm text-muted">
              La traduction se fait dans le navigateur : ouvrez TwinsChat dans Chrome sur ordinateur (version 138 ou plus récente).
            </p>
          ) : languages.length === 0 ? (
            <p className="px-3 py-2 text-sm text-muted">Ajoutez les langues que vous parlez dans votre profil.</p>
          ) : (
            languages.map((code) => (
              <button
                key={code}
                type="button"
                role="menuitemradio"
                aria-checked={value === code}
                onClick={() => pick(code)}
                className={`${item} ${value === code ? "font-medium text-accent-strong" : "text-foreground/90"}`}
              >
                <span className="min-w-0 flex-1 truncate">{languageName(code)}</span>
                {value === code && <Check className="size-4 shrink-0" strokeWidth={3} aria-hidden />}
              </button>
            ))
          )}
          {value && (
            <button type="button" role="menuitem" onClick={() => pick(null)} className={`${item} text-foreground/90`}>
              Afficher les messages originaux
            </button>
          )}
          <div className="mt-1 border-t border-border/60 pt-1">
            <Link
              href={settingsHref}
              className={`${item} ${enabled ? "text-xs text-muted hover:text-foreground" : "font-medium text-accent-strong"}`}
              onClick={() => setOpen(false)}
            >
              {enabled ? "Réglages de traduction" : "Activer la traduction"}
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
