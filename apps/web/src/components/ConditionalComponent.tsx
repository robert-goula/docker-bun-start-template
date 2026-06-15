import React from 'react';

type AsProp<C extends React.ElementType> = {
  as?: C;
};

type PropsToOmit<C extends React.ElementType, P> = keyof (AsProp<C> & P);

type ConditionalComponentProps<C extends React.ElementType, Props = {}> =
  Props & AsProp<C> & Omit<React.ComponentPropsWithoutRef<C>, PropsToOmit<C, Props>>;

const ConditionalComponent = <C extends React.ElementType = 'div'>(
  { as, children, ...props }: ConditionalComponentProps<C>
): React.ReactElement | null => {
  if (!children) {
    return null;
  }

  const Component = as || 'div';
  return <Component {...props}>{children}</Component>;
};

export default ConditionalComponent;
