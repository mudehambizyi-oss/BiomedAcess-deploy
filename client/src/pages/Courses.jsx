import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import CourseCard from '../components/CourseCard.jsx';
import { useAuth } from '../auth.jsx';

export default function Courses() {
  const { user } = useAuth();
  const [courses, setCourses] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    api('/courses').then(setCourses).catch((e) => setError(e.message));
  }, [user?.id]);
  return (
    <div className="container">
      <div className="page-head">
        <div>
          <h1>Course catalogue</h1>
          <p className="muted">Free and paid courses covering core biomedical sciences. Topics unlock once you enroll.</p>
        </div>
      </div>
      {error && <div className="alert error">{error}</div>}
      {courses === null && !error && <p className="muted">Loading courses...</p>}
      {courses && courses.length === 0 && <div className="card empty">No courses are published yet.</div>}
      <div className="grid cols-3">
        {courses?.map((c) => <CourseCard key={c.id} course={c} />)}
      </div>
    </div>
  );
}
