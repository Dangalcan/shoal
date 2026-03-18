import React from 'react';
import { cn } from '../../lib/utils';


type AnimationType = 'fade' | 'slide-up' | 'slide-down' | 'slide-left' | 'slide-right' | 'scale';

interface AnimateProps {
  children: React.ReactNode;
  type?: AnimationType;
  delay?: number;
  className?: string;
  as?: React.ElementType;
}

const animationClasses: Record<AnimationType, string> = {
  fade: 'animate-fade-in',
  'slide-up': 'animate-slide-in-bottom',
  'slide-down': 'animate-slide-in-top',
  'slide-left': 'animate-slide-in-right',
  'slide-right': 'animate-slide-in-left',
  scale: 'animate-scale-in',
};

export function Animate({
  children,
  type = 'fade',
  delay = 0,
  className,
  as: Component = 'div',
}: AnimateProps) {
  const style = delay > 0 ? { animationDelay: `${delay}ms` } : undefined;

  return (
    <Component
      className={cn(animationClasses[type], className)}
      style={style}
    >
      {children}
    </Component>
  );
}
