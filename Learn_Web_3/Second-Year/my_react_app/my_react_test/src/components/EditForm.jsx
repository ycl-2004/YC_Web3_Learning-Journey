import { useState } from "react";

function EditForm({ todo, editTodo, toggleIsEditing, isLocked }) {
  const [task, setTask] = useState(todo.content);
  const [minutes, setMinutes] = useState(todo.minutes ?? 25);

  const isValid = task.trim().length > 0;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!isValid || isLocked) return;
    editTodo(todo.id, task.trim(), Number(minutes));
  };

  return (
    <form className="edit-form" onSubmit={handleSubmit}>
      <input
        type="text"
        placeholder="Edit task…"
        value={task}
        onChange={(e) => setTask(e.target.value)}
        disabled={isLocked}
        autoFocus
      />

      <div className="edit-row">
        <select
          className="time-select"
          value={minutes}
          onChange={(e) => setMinutes(e.target.value)}
          disabled={isLocked}
          aria-label="Edit minutes"
        >
          {[5, 10, 15, 20, 25, 30, 45, 60].map((m) => (
            <option key={m} value={m}>
              {m}m
            </option>
          ))}
        </select>

        <div className="edit-actions">
          <button
            type="button"
            className="btn ghost"
            onClick={() => toggleIsEditing(todo.id)}
            disabled={isLocked}
          >
            Cancel
          </button>
          <button type="submit" className="btn" disabled={!isValid || isLocked}>
            Save
          </button>
        </div>
      </div>
    </form>
  );
}

export default EditForm;
