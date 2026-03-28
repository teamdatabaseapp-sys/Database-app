import React from 'react';
import { ClientListScreen } from './ClientListScreen';

interface ClientsSectionProps {
  onAddClient: () => void;
  onSelectClient: (id: string) => void;
}

export function ClientsSection({ onAddClient, onSelectClient }: ClientsSectionProps) {
  return (
    <ClientListScreen
      onAddClient={onAddClient}
      onSelectClient={onSelectClient}
    />
  );
}
