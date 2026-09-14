import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  AlertCircle,
  ArrowLeft,
  ChevronRight,
  LockKeyhole,
  MessageCircle,
  PenLine,
  Plus,
  RefreshCw,
  Search,
  Send,
  Sparkles,
  UserRound,
} from "lucide-react";
import {
  getGetProfileQueryKey,
  getListSocialConversationsQueryKey,
  getListSocialMessagesQueryKey,
  useCreateSocialConversation,
  useCreateSocialMessage,
  useGetProfile,
  useListSocialConversations,
  useListSocialMessages,
} from "@workspace/api-client-react";
import type { MediaAttachment, SocialConversation, SocialMessage } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { MediaPicker, MediaRenderer } from "@/components/media";

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "V";
}

function relativeTime(value?: string | null) {
  if (!value) return "No messages yet";
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 45) return "Just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(new Date(value));
}

function fullTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

function SocialAvatar({
  name,
  avatarUrl,
  size = "md",
}: {
  name: string;
  avatarUrl?: string;
  size?: "sm" | "md" | "lg";
}) {
  const [failed, setFailed] = useState(false);
  if (!avatarUrl || failed) {
    return <div className={`messages-avatar messages-avatar-${size}`}>{initials(name)}</div>;
  }
  return (
    <img
      className={`messages-avatar messages-avatar-${size}`}
      src={avatarUrl}
      alt={`${name} avatar`}
      onError={() => setFailed(true)}
    />
  );
}

function ListSkeleton() {
  return (
    <div className="messages-skeleton-list" aria-label="Loading conversations">
      {[1, 2, 3, 4].map((item) => (
        <div className="messages-skeleton-row" key={item}>
          <span />
          <div><i /><i /></div>
        </div>
      ))}
    </div>
  );
}

function ThreadSkeleton() {
  return (
    <div className="messages-skeleton-thread" aria-label="Loading messages">
      <span /><span /><span /><span />
    </div>
  );
}

function EmptyThread() {
  return (
    <div className="messages-empty-thread">
      <div className="messages-empty-mark"><MessageCircle /></div>
      <span className="eyebrow">A quiet beginning</span>
      <h2>Make the first move.</h2>
      <p>Share a thought, ask about their latest work, or open a door to the next collaboration.</p>
    </div>
  );
}

function ConversationRow({
  conversation,
  selected,
  onSelect,
}: {
  conversation: SocialConversation;
  selected: boolean;
  onSelect: () => void;
}) {
  const participant = conversation.otherParticipant;
  return (
    <button
      type="button"
      className={`messages-conversation ${selected ? "is-selected" : ""}`}
      onClick={onSelect}
      aria-pressed={selected}
    >
      <SocialAvatar name={participant.displayName} avatarUrl={participant.avatarUrl} size="md" />
      <span className="messages-conversation-copy">
        <strong>{participant.displayName}</strong>
        <small>@{participant.username}</small>
        <span>{conversation.lastMessage?.body ?? "Start the conversation"}</span>
      </span>
      <span className="messages-conversation-meta">
        <small>{relativeTime(conversation.lastMessage?.createdAt ?? conversation.updatedAt)}</small>
        <ChevronRight />
      </span>
    </button>
  );
}

function MessageBubble({ message, own }: { message: SocialMessage; own: boolean }) {
  return (
    <div className={`messages-bubble-row ${own ? "is-own" : ""}`}>
      {!own && <SocialAvatar name={message.sender.displayName} avatarUrl={message.sender.avatarUrl} size="sm" />}
      <div className="messages-bubble-wrap">
        <div className="messages-bubble">
          <p>{message.body}</p>
          <MediaRenderer attachments={message.attachments} mediaUrl={message.mediaUrl} mediaType={message.mediaType} label={`Załącznik wiadomości od ${message.sender.displayName}`} />
        </div>
        <time dateTime={message.createdAt} title={fullTime(message.createdAt)}>{relativeTime(message.createdAt)}</time>
      </div>
    </div>
  );
}

export default function MessagesPage() {
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();
  const profile = useGetProfile({
    query: {
      queryKey: getGetProfileQueryKey(),
      staleTime: 60_000,
    },
  });
  const conversations = useListSocialConversations({
    query: {
      queryKey: getListSocialConversationsQueryKey(),
      staleTime: 15_000,
      refetchOnWindowFocus: true,
    },
  });
  const [activeId, setActiveId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [profileId, setProfileId] = useState(() => new URLSearchParams(window.location.search).get("profile") ?? "");
  const [messageBody, setMessageBody] = useState("");
  const [messageAttachment, setMessageAttachment] = useState<MediaAttachment | null>(null);
  const [mediaPickerKey, setMediaPickerKey] = useState(0);
  const [mediaUploading, setMediaUploading] = useState(false);
  const [showStartForm, setShowStartForm] = useState(false);

  const activeConversation = useMemo(
    () => conversations.data?.find((conversation) => conversation.id === activeId) ?? null,
    [activeId, conversations.data],
  );
  const messages = useListSocialMessages(activeId ?? "", {
    query: {
      enabled: Boolean(activeId),
      queryKey: getListSocialMessagesQueryKey(activeId ?? ""),
      staleTime: 5_000,
      refetchOnWindowFocus: true,
    },
  });
  const orderedMessages = useMemo(
    () => [...(messages.data?.items ?? [])].sort(
      (left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime(),
    ),
    [messages.data?.items],
  );

  useEffect(() => {
    if (!activeId && conversations.data?.[0]) {
      setActiveId(conversations.data[0].id);
    }
  }, [activeId, conversations.data]);

  const createConversation = useCreateSocialConversation({
    mutation: {
      onSuccess: (conversation) => {
        setActiveId(conversation.id);
        setProfileId("");
        setShowStartForm(false);
        void queryClient.invalidateQueries({ queryKey: getListSocialConversationsQueryKey() });
        toast({ title: "Conversation opened", description: `You can now write to ${conversation.otherParticipant.displayName}.` });
      },
      onError: () => {
        toast({
          title: "Could not start the conversation",
          description: "Check the profile ID and try again.",
          variant: "destructive",
        });
      },
    },
  });
  const sendMessage = useCreateSocialMessage({
    mutation: {
      onSuccess: (message) => {
        setMessageBody("");
        setMessageAttachment(null);
        setMediaPickerKey((value) => value + 1);
        queryClient.setQueryData(
          getListSocialMessagesQueryKey(message.conversationId),
          (current: typeof messages.data | undefined) => current
            ? { ...current, items: [...current.items, message] }
            : { items: [message], page: 1, hasMore: false },
        );
        void queryClient.invalidateQueries({ queryKey: getListSocialConversationsQueryKey() });
        void queryClient.invalidateQueries({ queryKey: getListSocialMessagesQueryKey(message.conversationId) });
        toast({ title: "Message sent", description: "Your note is on its way." });
      },
      onError: () => {
        toast({
          title: "Message not sent",
          description: "Try again in a moment.",
          variant: "destructive",
        });
      },
    },
  });

  const filteredConversations = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return conversations.data ?? [];
    return (conversations.data ?? []).filter((conversation) => {
      const person = conversation.otherParticipant;
      return `${person.displayName} ${person.username}`.toLowerCase().includes(term);
    });
  }, [conversations.data, search]);

  const handleStartConversation = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = profileId.trim();
    if (!value || createConversation.isPending) return;
    createConversation.mutate({ data: { profileId: value } });
  };

  const handleSend = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const body = messageBody.trim();
    if (!activeId || (!body && !messageAttachment) || sendMessage.isPending) return;
    sendMessage.mutate({ conversationId: activeId, data: { body: body || undefined, attachmentId: messageAttachment?.id ?? null } });
  };

  return (
    <div className="messages-page">
      <div className="messages-heading">
        <div>
          <span className="eyebrow">Private space</span>
          <h1>Messages<span className="title-dot">.</span></h1>
          <p>Good conversations make better work.</p>
        </div>
        <div className="messages-heading-note"><LockKeyhole /><span>Only you and the creator<br />can see these threads</span></div>
      </div>

      <section className={`messages-workspace ${activeId ? "has-active-thread" : ""}`}>
        <aside className="messages-sidebar">
          <div className="messages-sidebar-top">
            <div>
              <span className="eyebrow">Your conversations</span>
              <h2>{conversations.data?.length ?? 0}<small> threads</small></h2>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="messages-new-button"
              onClick={() => setShowStartForm((current) => !current)}
              aria-label="Start a new conversation"
            >
              <PenLine />
            </Button>
          </div>

          {showStartForm && (
            <form className="messages-start-form" onSubmit={handleStartConversation}>
              <label htmlFor="profile-id">Start with a Player ID</label>
              <div>
                <input
                  id="profile-id"
                  value={profileId}
                  onChange={(event) => setProfileId(event.target.value)}
                  placeholder="Paste Player ID"
                  autoComplete="off"
                  required
                />
                <Button type="submit" size="sm" disabled={createConversation.isPending || !profileId.trim()}>
                  {createConversation.isPending ? "Opening" : "Open"}
                </Button>
              </div>
              <small>Paste the Player ID shown on their profile to begin a private thread.</small>
            </form>
          )}

          <label className="messages-search">
            <Search />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search conversations" aria-label="Search conversations" />
          </label>

          <div className="messages-conversation-list">
            {conversations.isLoading ? <ListSkeleton /> : conversations.isError ? (
              <div className="messages-inline-state">
                <AlertCircle />
                <strong>Couldn’t load your threads</strong>
                <p>Your conversations are still here. Try the connection again.</p>
                <Button type="button" variant="secondary" size="sm" onClick={() => void conversations.refetch()}><RefreshCw /> Try again</Button>
              </div>
            ) : filteredConversations.length === 0 ? (
              <div className="messages-list-empty">
                <div className="messages-empty-mark"><Sparkles /></div>
                <strong>{search ? "No matching threads" : "Your inbox is open"}</strong>
                <p>{search ? "Try another name or username." : "Start a conversation with a creator whose work stays with you."}</p>
                {!search && <button type="button" onClick={() => setShowStartForm(true)}><Plus /> Start a conversation</button>}
              </div>
            ) : filteredConversations.map((conversation) => (
              <ConversationRow
                key={conversation.id}
                conversation={conversation}
                selected={conversation.id === activeId}
                onSelect={() => setActiveId(conversation.id)}
              />
            ))}
          </div>
        </aside>

        <section className="messages-thread" aria-label={activeConversation ? `Conversation with ${activeConversation.otherParticipant.displayName}` : "Conversation"}>
          {activeConversation ? (
            <>
              <header className="messages-thread-header">
                <Button type="button" variant="ghost" size="icon" className="messages-back-button" onClick={() => setActiveId(null)} aria-label="Back to conversations"><ArrowLeft /></Button>
                <SocialAvatar name={activeConversation.otherParticipant.displayName} avatarUrl={activeConversation.otherParticipant.avatarUrl} size="md" />
                <div>
                  <h2>{activeConversation.otherParticipant.displayName}</h2>
                  <span>@{activeConversation.otherParticipant.username}</span>
                </div>
                 <button type="button" className="messages-profile-link" onClick={() => navigate(`/profile/${activeConversation.otherParticipant.id}`)}>
                  <UserRound /> View profile
                </button>
              </header>
              <div className="messages-thread-body">
                <div className="messages-thread-intro">
                  <div className="messages-intro-line" />
                  <span>Private conversation · {activeConversation.otherParticipant.displayName}</span>
                  <div className="messages-intro-line" />
                </div>
                {messages.isLoading ? <ThreadSkeleton /> : messages.isError ? (
                  <div className="messages-inline-state thread-state">
                    <AlertCircle />
                    <strong>This thread missed a beat</strong>
                    <p>We couldn’t load the messages right now.</p>
                    <Button type="button" variant="secondary" size="sm" onClick={() => void messages.refetch()}><RefreshCw /> Try again</Button>
                  </div>
                ) : orderedMessages.length === 0 ? <EmptyThread /> : orderedMessages.map((message) => (
                  <MessageBubble key={message.id} message={message} own={message.sender.id === profile.data?.id} />
                ))}
              </div>
              <form className="messages-composer" onSubmit={handleSend}>
                <textarea
                  value={messageBody}
                  onChange={(event) => setMessageBody(event.target.value)}
                  placeholder={`Write to ${activeConversation.otherParticipant.displayName.split(" ")[0]}...`}
                  rows={1}
                  maxLength={2000}
                  aria-label="Message"
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      event.currentTarget.form?.requestSubmit();
                    }
                  }}
                />
                <div className="messages-composer-footer">
                  <span>{messageBody.length > 0 ? `${messageBody.length}/2000` : "Press Enter to send"}</span>
                   <MediaPicker key={mediaPickerKey} label="➕ Dodaj zdjęcie lub film" onChange={setMessageAttachment} onUploadingChange={setMediaUploading} disabled={sendMessage.isPending} />
                   <Button type="submit" className="messages-send-button" disabled={sendMessage.isPending || mediaUploading || (!messageBody.trim() && !messageAttachment)}>
                    <Send /> {sendMessage.isPending ? "Sending" : "Send"}
                  </Button>
                </div>
              </form>
            </>
          ) : (
            <div className="messages-no-selection">
              <div className="messages-no-selection-art">
                <MessageCircle />
                <span />
                <span />
                <span />
              </div>
              <span className="eyebrow">Your private room</span>
              <h2>Choose a conversation.</h2>
              <p>Select a thread to pick up where you left off, or start something new with a creator.</p>
              <Button type="button" variant="secondary" onClick={() => setShowStartForm(true)}><Plus /> Start a conversation</Button>
            </div>
          )}
        </section>
      </section>
    </div>
  );
}