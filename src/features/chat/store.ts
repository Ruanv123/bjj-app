import { create } from 'zustand';

/** Pedido para a conversa rolar até uma mensagem (vindo da busca). */
export type JumpRequest = { conversationId: string; messageId: string; createdAt: string };

type ChatSessionState = {
  /** Conversa aberta na tela: não mostramos push dela (a pessoa já está lendo). */
  activeConversationId: string | null;
  /** Conversas de onde a pessoa foi removida/banida (ou que foram apagadas) nesta sessão. */
  revokedConversationIds: string[];
  jumpRequest: JumpRequest | null;
  requestJump: (request: JumpRequest) => void;
  clearJump: () => void;
  setActiveConversation: (id: string | null) => void;
  markRevoked: (id: string) => void;
  clearRevoked: (id: string) => void;
};

/** Estado de sessão do chat (não persiste). */
export const useChatSession = create<ChatSessionState>()((set) => ({
  activeConversationId: null,
  revokedConversationIds: [],
  jumpRequest: null,
  requestJump: (jumpRequest) => set({ jumpRequest }),
  clearJump: () => set({ jumpRequest: null }),
  setActiveConversation: (activeConversationId) => set({ activeConversationId }),
  markRevoked: (id) =>
    set((state) =>
      state.revokedConversationIds.includes(id)
        ? state
        : { revokedConversationIds: [...state.revokedConversationIds, id] }
    ),
  clearRevoked: (id) =>
    set((state) => ({
      revokedConversationIds: state.revokedConversationIds.filter((x) => x !== id),
    })),
}));
