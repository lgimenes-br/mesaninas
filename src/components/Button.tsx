import React from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline';
  size?: 'sm' | 'md' | 'lg';
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  className = '',
  disabled,
  ...props
}) => {
  const baseClasses = 'inline-flex items-center justify-center font-bold rounded-md transition-all duration-200 outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed select-none shadow-sm';

  const variants = {
    primary: 'bg-mesaninas-green text-mesaninas-creme hover:bg-opacity-90 active:bg-opacity-95 shadow-sm focus:ring-mesaninas-green/30 border border-transparent',
    secondary: 'bg-mesaninas-creme text-mesaninas-green hover:bg-opacity-90 active:bg-opacity-95 focus:ring-mesaninas-creme/50 border border-transparent',
    outline: 'bg-transparent text-mesaninas-green border border-mesaninas-green/30 hover:bg-mesaninas-green/5 focus:ring-mesaninas-green/20'
  };

  const sizes = {
    sm: 'px-4 h-9 text-xs gap-1.5',
    md: 'px-6 h-12 lg:h-10 text-sm gap-2',
    lg: 'px-8 h-12 text-base gap-2'
  };

  const combinedClasses = `${baseClasses} ${variants[variant]} ${sizes[size]} ${className}`;

  return (
    <button disabled={disabled} className={combinedClasses} {...props}>
      {children}
    </button>
  );
};

export default Button;
