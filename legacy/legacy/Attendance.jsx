import React, { useState, useEffect } from 'react';
import axios from 'axios';
import DashboardLayout from '../components/DashboardLayout';
import AdminAttendance from './AdminAttendance';

export default function Attendance() {
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  
  if (user.role !== 'Admin') {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <p className="text-slate-500">You do not have permission to view this page.</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <AdminAttendance />
    </DashboardLayout>
  );
}
