import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { cn } from '@/lib/cn';

interface ServiceTagBadgeProps {
  name: string;
  color: string;
  size?: 'sm' | 'md';
  onPress?: () => void;
  selected?: boolean;
  showRemove?: boolean;
  onRemove?: () => void;
}

export function ServiceTagBadge({
  name,
  color,
  size = 'md',
  onPress,
  selected = false,
  showRemove = false,
  onRemove,
}: ServiceTagBadgeProps) {
  const Container = onPress ? Pressable : View;

  const sizeStyles = {
    sm: 'px-2 py-1',
    md: 'px-3 py-1.5',
  };

  const textSizes = {
    sm: 'text-xs',
    md: 'text-sm',
  };

  return (
    <Container
      onPress={onPress}
      className={cn(
        'flex-row items-center rounded-full mr-2 mb-2',
        sizeStyles[size],
        selected ? 'ring-2 ring-offset-1' : ''
      )}
      style={{ backgroundColor: `${color}20` }}
    >
      <View
        className="w-2 h-2 rounded-full mr-1.5"
        style={{ backgroundColor: color }}
      />
      <Text
        className={cn('font-medium', textSizes[size])}
        style={{ color: color }}
      >
        {name}
      </Text>
      {showRemove && onRemove && (
        <Pressable onPress={onRemove} className="ml-1.5 -mr-1">
          <Text style={{ color: color }} className="font-bold">×</Text>
        </Pressable>
      )}
    </Container>
  );
}
