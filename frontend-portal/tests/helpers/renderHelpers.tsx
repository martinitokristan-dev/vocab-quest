import { render, RenderOptions } from '@testing-library/react';
import { ReactElement, ReactNode } from 'react';
import { BrowserRouter } from 'react-router-dom';

/**
 * Custom render function that wraps components with common providers
 * for testing purposes.
 */
interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  initialRoute?: string;
  withRouter?: boolean;
}

/**
 * Wrapper component that provides React Router context
 */
function AllTheProviders({ children }: { children: ReactNode }) {
  return <BrowserRouter>{children}</BrowserRouter>;
}

/**
 * Custom render function with common test providers
 * 
 * @param ui - The React element to render
 * @param options - Render options including custom providers
 * @returns The render result from @testing-library/react
 * 
 * @example
 * ```tsx
 * const { getByText } = renderWithProviders(<MyComponent />);
 * ```
 */
export function renderWithProviders(
  ui: ReactElement,
  { withRouter = true, ...renderOptions }: CustomRenderOptions = {}
) {
  const Wrapper = withRouter ? AllTheProviders : undefined;

  return render(ui, {
    wrapper: Wrapper,
    ...renderOptions,
  });
}

/**
 * Re-export everything from @testing-library/react
 */
export * from '@testing-library/react';
