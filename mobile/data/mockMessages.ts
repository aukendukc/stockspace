import { User } from "./mockData";

export interface DirectMessage {
  id: string;
  author: User;
  text: string;
  createdAt: string;
}

export interface Conversation {
  id: string;
  user: User;
  messages: DirectMessage[];
  unread?: number;
}

export const mockConversations: Conversation[] = [
  {
    id: "dm-1",
    user: { id: "2", name: "佐藤花子", handle: "@sato" },
    unread: 1,
    messages: [
      {
        id: "dm-1-1",
        author: { id: "2", name: "佐藤花子", handle: "@sato" },
        text: "トヨタの決算、資料読みました？",
        createdAt: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
      },
      {
        id: "dm-1-2",
        author: { id: "1", name: "田中太郎", handle: "@tanaka" },
        text: "ざっと見ました！営業益すごかったですね。",
        createdAt: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
      },
    ],
  },
  {
    id: "dm-2",
    user: { id: "3", name: "鈴木一郎", handle: "@suzuki" },
    messages: [
      {
        id: "dm-2-1",
        author: { id: "3", name: "鈴木一郎", handle: "@suzuki" },
        text: "PF公開ありがとう！真似していい？",
        createdAt: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
      },
    ],
  },
];

