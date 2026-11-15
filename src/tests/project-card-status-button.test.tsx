import { describe, it, expect, vi } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { ProjectCardStatusButton } from '../modules/project/components/ProjectCardStatusButton';

describe('ProjectCardStatusButton', () => {
  it('renders current status with button pill', () => {
    const div = document.createElement('div');
    document.body.appendChild(div);
    const root = createRoot(div);

    act(() => {
      root.render(
        <ProjectCardStatusButton
          status="In Progress"
          onChange={vi.fn()}
        />
      );
    });

    expect(div.innerHTML).toContain('In Progress');
    root.unmount();
    div.remove();
  });

  it('opens status menu when clicked and displays status options', () => {
    const div = document.createElement('div');
    document.body.appendChild(div);
    const root = createRoot(div);

    act(() => {
      root.render(
        <ProjectCardStatusButton
          status="In Progress"
          onChange={vi.fn()}
        />
      );
    });

    const button = div.querySelector('button');
    expect(button).toBeDefined();

    act(() => {
      button?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(div.innerHTML).toContain('Change Status');
    expect(div.innerHTML).toContain('Not Started');
    expect(div.innerHTML).toContain('In Progress');
    expect(div.innerHTML).toContain('Completed');

    root.unmount();
    div.remove();
  });

  it('calls onChange with closure and Completed when clicking Completed option', () => {
    const div = document.createElement('div');
    document.body.appendChild(div);
    const root = createRoot(div);
    const onChange = vi.fn();

    act(() => {
      root.render(
        <ProjectCardStatusButton
          status="In Progress"
          onChange={onChange}
        />
      );
    });

    const button = div.querySelector('button');
    act(() => {
      button?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    const optionButtons = Array.from(div.querySelectorAll('[role="option"]'));
    const completedBtn = optionButtons.find((btn) => btn.textContent?.includes('Completed'));
    expect(completedBtn).toBeDefined();

    act(() => {
      completedBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('closure', 'Completed');

    root.unmount();
    div.remove();
  });

  it('does not trigger onChange when clicking the currently active status', () => {
    const div = document.createElement('div');
    document.body.appendChild(div);
    const root = createRoot(div);
    const onChange = vi.fn();

    act(() => {
      root.render(
        <ProjectCardStatusButton
          status="In Progress"
          onChange={onChange}
        />
      );
    });

    const button = div.querySelector('button');
    act(() => {
      button?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    const optionButtons = Array.from(div.querySelectorAll('[role="option"]'));
    const inProgressBtn = optionButtons.find((btn) => btn.textContent?.includes('In Progress'));

    act(() => {
      inProgressBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(onChange).not.toHaveBeenCalled();

    root.unmount();
    div.remove();
  });
});
