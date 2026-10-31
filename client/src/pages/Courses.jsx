import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../api.js';
import CourseCard from '../components/CourseCard.jsx';
import { useAuth } from '../auth.jsx';

const categoryFor = (discipline = '') => {
  const d = discipline.toLowerCase();
  if (['anatomy', 'pharmacology', 'entomology', 'public health', 'biostatistics'].some((x) => d.includes(x))) return 'Basic sciences';
  if (['parasitology', 'histopathology', 'virology', 'immunology'].some((x) => d.includes(x))) return 'Pre-clinical';
  return 'Clinical';
};
const FILTERS = ['All', 'Basic sciences', 'Pre-clinical', 'Clinical'];

export default function Courses() {
  const { user } = useAuth();
  const [courses, setCourses] = useState(null);
  const [filter, setFilter] = useState('All');
  const [error, setError] = useState('');
  useEffect(() => {
    setCourses(null); setError('');
    api('/courses').then(setCourses).catch((e) => setError(e.message));
  }, [user?.id]);
  const visible = useMemo(() => (courses || []).filter((c) => filter === 'All' || categoryFor(c.discipline) === filter), [courses, filter]);
  return (
    <div className="container">
      <div className="page-head">
        <div>
          <h1>Course catalogue</h1>
          <p className="muted">Free and paid courses covering core biomedical sciences. Topics unlock once you enroll.</p>
        </div>
      </div>
      <div className="catalog-filters" role="group" aria-label="Filter courses by category">
        {FILTERS.map((name) => <button key={name} type="button" className={`btn small ${filter === name ? 'teal' : 'ghost'}`} aria-pressed={filter === name} onClick={() => setFilter(name)}>{name}</button>)}
      </div>
      {error && <div className="alert error">{error}</div>}
      {courses === null && !error && <p className="muted">Loading courses...</p>}
      {courses && visible.length === 0 && <div className="card empty">{courses.length ? 'No courses in this category yet.' : 'No courses are published yet.'}</div>}
      <div className="grid cols-3">
        {visible.map((c) => <CourseCard key={c.id} course={{ ...c, catalog_category: categoryFor(c.discipline) }} />)}
      </div>
    </div>
  );
}
