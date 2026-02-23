import { createContext, useContext, useState, useCallback, ReactNode, useEffect } from "react";
import { apiClient, ConversationResponse, ConversationDetailResponse, DirectMessageResponse } from "../services/api";
import { useApp } from "./AppContext";

export interface Conversation {
  id: string;
  otherUser: {
    id: string;
    name: string;
    handle: string;
    iconUrl?: string | null;
  };
  lastMessage?: {
    id: string;
    text: string;
    senderId: string;
    createdAt: string;
    isRead: boolean;
  };
  unreadCount: number;
  createdAt: string;
}

export interface DirectMessage {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  senderHandle: string;
  text: string;
  isRead: boolean;
  createdAt: string;
}

export interface ConversationDetail {
  id: string;
  otherUser: {
    id: string;
    name: string;
    handle: string;
    iconUrl?: string | null;
  };
  messages: DirectMessage[];
  createdAt: string;
}

interface MessageContextType {
  conversations: Conversation[];
  loading: boolean;
  error: string | null;
  refreshConversations: () => Promise<void>;
  getConversation: (conversationId: string) => Promise<ConversationDetail | null>;
  sendMessage: (conversationId: string, text: string) => Promise<DirectMessage | null>;
  startConversation: (userId: string, initialMessage: string) => Promise<ConversationDetail | null>;
  markAsRead: (conversationId: string) => Promise<void>;
}

const MessageContext = createContext<MessageContextType | undefined>(undefined);

// API レスポンスをローカル型に変換
const convertConversation = (conv: ConversationResponse): Conversation => ({
  id: conv.id.toString(),
  otherUser: {
    id: conv.other_user.id.toString(),
    name: conv.other_user.name,
    handle: conv.other_user.handle,
    iconUrl: conv.other_user.icon_url,
  },
  lastMessage: conv.last_message ? {
    id: conv.last_message.id.toString(),
    text: conv.last_message.text,
    senderId: conv.last_message.sender_id.toString(),
    createdAt: conv.last_message.created_at,
    isRead: conv.last_message.is_read,
  } : undefined,
  unreadCount: conv.unread_count,
  createdAt: conv.created_at,
});

const convertMessage = (msg: DirectMessageResponse): DirectMessage => ({
  id: msg.id.toString(),
  conversationId: msg.conversation_id.toString(),
  senderId: msg.sender_id.toString(),
  senderName: msg.sender.name,
  senderHandle: msg.sender.handle,
  text: msg.text,
  isRead: msg.is_read,
  createdAt: msg.created_at,
});

const convertConversationDetail = (detail: ConversationDetailResponse): ConversationDetail => ({
  id: detail.id.toString(),
  otherUser: {
    id: detail.other_user.id.toString(),
    name: detail.other_user.name,
    handle: detail.other_user.handle,
    iconUrl: detail.other_user.icon_url,
  },
  messages: detail.messages.map(convertMessage),
  createdAt: detail.created_at,
});

export const MessageProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useApp();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshConversations = useCallback(async () => {
    if (!user) {
      setConversations([]);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const data = await apiClient.getConversations();
      setConversations(Array.isArray(data) ? data.map(convertConversation) : []);
    } catch (err: any) {
      const msg = err?.message ?? "";
      const isAuth = msg.includes("401") || msg.includes("Not authenticated") || msg.includes("認証");
      const isServer = msg.includes("サーバーエラー") || msg.includes("500") || msg.includes("しばらくしてから");
      if (!isAuth && !isServer) console.error("Error fetching conversations:", err);
      if (isAuth) {
        setError(null);
        setConversations([]);
      } else {
        setError(isServer ? null : (msg.trim() ? msg : "会話の取得に失敗しました。"));
        setConversations([]);
      }
    } finally {
      setLoading(false);
    }
  }, [user]);

  // ユーザーがログインしたら会話を取得（.catch で未処理の Promise を防ぐ）
  useEffect(() => {
    if (user) {
      refreshConversations().catch(() => {
        setConversations([]);
        setLoading(false);
      });
    } else {
      setConversations([]);
    }
  }, [user, refreshConversations]);

  const getConversation = useCallback(async (conversationId: string): Promise<ConversationDetail | null> => {
    if (!user) return null;
    
    try {
      const data = await apiClient.getConversation(parseInt(conversationId));
      return convertConversationDetail(data);
    } catch (err) {
      console.error("Error fetching conversation:", err);
      return null;
    }
  }, [user]);

  const sendMessage = useCallback(async (conversationId: string, text: string): Promise<DirectMessage | null> => {
    if (!user || !text.trim()) return null;

    try {
      const data = await apiClient.sendMessage(parseInt(conversationId), text.trim());
      const message = convertMessage(data);
      
      // ローカルの会話リストを更新
      setConversations(prev => prev.map(conv => {
        if (conv.id === conversationId) {
          return {
            ...conv,
            lastMessage: {
              id: message.id,
              text: message.text,
              senderId: message.senderId,
              createdAt: message.createdAt,
              isRead: message.isRead,
            },
          };
        }
        return conv;
      }));
      
      return message;
    } catch (err) {
      console.error("Error sending message:", err);
      return null;
    }
  }, [user]);

  const startConversation = useCallback(async (userId: string, initialMessage: string): Promise<ConversationDetail | null> => {
    if (!user || !initialMessage.trim()) return null;

    try {
      const data = await apiClient.startConversation(parseInt(userId), initialMessage.trim());
      const detail = convertConversationDetail(data);
      
      // 会話リストを更新
      await refreshConversations();
      
      return detail;
    } catch (err) {
      console.error("Error starting conversation:", err);
      return null;
    }
  }, [user, refreshConversations]);

  const markAsRead = useCallback(async (conversationId: string): Promise<void> => {
    if (!user) return;

    try {
      await apiClient.markConversationAsRead(parseInt(conversationId));
      
      // ローカルの未読数を更新
      setConversations(prev => prev.map(conv => {
        if (conv.id === conversationId) {
          return { ...conv, unreadCount: 0 };
        }
        return conv;
      }));
    } catch (err) {
      console.error("Error marking as read:", err);
    }
  }, [user]);

  return (
    <MessageContext.Provider
      value={{
        conversations,
        loading,
        error,
        refreshConversations,
        getConversation,
        sendMessage,
        startConversation,
        markAsRead,
      }}
    >
      {children}
    </MessageContext.Provider>
  );
};

export const useMessages = () => {
  const ctx = useContext(MessageContext);
  if (!ctx) {
    throw new Error("useMessages must be used within MessageProvider");
  }
  return ctx;
};
