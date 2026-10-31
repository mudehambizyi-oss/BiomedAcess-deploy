import React from 'react';
import { Link } from 'react-router-dom';

export function formatPrice(cents, currency = 'usd') {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency.toUpperCase() }).format((cents || 0) / 100);
}

export default function CourseCard({ course }) {
  return (
    <Link to={`/courses/${course.id}`} className="card course-card">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <span className="badge">{course.level}</span>
        {course.discipline && <span className="badge discipline">{course.discipline}</span>}
        {course.is_paid ? <span className="badge paid">{formatPrice(course.price_cents, course.currency)}</span> : <span className="badge teal">Free</span>}
      </div>
      {course.image_url && <img className="course-cover" src={course.image_url} alt={`${course.title} cover`} loading="lazy" />}
      <h3>{course.title}</h3>
      <p className="muted small" style={{ margin: 0 }}>{course.description}</p>
      <div className="foot">
        <span className="small muted">{course.topic_count} topics</span>
        {course.document_count > 0 && <span className="small muted">{course.document_count} docs</span>}
        {course.exam_count > 0 && <span className="small muted">{course.exam_count} exam{course.exam_count === 1 ? '' : 's'}</span>}
        {course.enrolled && course.progress ? (
          <span className="small" style={{ color: 'var(--teal)', fontWeight: 600 }}>{course.progress.percent}% complete</span>
        ) : course.enrolled ? <span className="small" style={{ color: 'var(--teal)', fontWeight: 600 }}>Enrolled</span> : null}
      </div>
      {course.enrolled && course.progress && <div className="progress"><span style={{ width: `${course.progress.percent}%` }} /></div>}
    </Link>
  );
}
