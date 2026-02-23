import { useEffect, useRef } from 'react';
import type { HelmMessage } from '../../lib/types';
import MessageBubble from './MessageBubble';
import { LoadingSpinner } from '../shared';
import './MessageList.css';

interface MessageListProps {
  messages: HelmMessage[];
  loading: boolean;
}

export default function MessageList({ messages, loading }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  if (loading) {
    return (
      <div className="message-list message-list--loading">
        <LoadingSpinner size="md" />
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="message-list message-list--empty">
        <p className="message-list__empty-text">
          How can I help you navigate today?
        </p>
      </div>
    );
  }

  return (
    <div className="message-list" ref={containerRef}>
      {messages.map((msg) => (
        <MessageBubble key={msg.id} message={msg} />
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
