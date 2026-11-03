import { describe, it, expect } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { bootstrap } from '../app/bootstrap';
import { CourseList } from '../modules/training/pages/CourseList';
import { AppProviders } from '../app/AppProviders';
import { DataTable } from '../shared/ui/DataTable';

describe('CourseList & DataTable Resilience', () => {
  it('DataTable gracefully handles empty or undefined rows without crashing', () => {
    const div = document.createElement('div');
    document.body.appendChild(div);
    const root = createRoot(div);

    act(() => {
      root.render(
        <DataTable
          columns={[{ key: 'name', header: 'Name', accessor: (r: any) => r?.name }]}
          rows={undefined as any}
          rowKey={(r: any) => r?.id || '1'}
        />
      );
    });

    expect(div.innerHTML).toContain('Nothing here yet');
    root.unmount();
    div.remove();
  });

  it('CourseList mounts and renders catalog without throwing 500 render errors', async () => {
    bootstrap();
    const div = document.createElement('div');
    document.body.appendChild(div);
    const root = createRoot(div);

    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={['/app/training/courses']}>
          <AppProviders>
            <CourseList defaultTab="courses" />
          </AppProviders>
        </MemoryRouter>
      );
    });

    expect(div.innerHTML).toContain('Courses');
    root.unmount();
    div.remove();
  });
});
