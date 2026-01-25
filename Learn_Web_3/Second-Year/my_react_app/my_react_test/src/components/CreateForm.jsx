import { useState } from "react";

function CreateForm({ addTodo, isLocked }) {
  const [task, setTask] = useState("");
  const [minutes, setMinutes] = useState(25);

  const isValid = task.trim().length > 0;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!isValid || isLocked) return;
    addTodo(task.trim(), Number(minutes));
    setTask("");
  };

  return (
    <form className="create-form" onSubmit={handleSubmit}>
      <input
        type="text"
        placeholder="Add a task…"
        value={task}
        onChange={(e) => setTask(e.target.value)}
        disabled={isLocked}
        autoFocus
      />

      <select
        className="time-select"
        value={minutes}
        onChange={(e) => setMinutes(e.target.value)}
        disabled={isLocked}
        aria-label="Task minutes"
      >
        {[5, 10, 1, 20, 25, 30, 45, 60].map((m) => (
          <option key={m} value={m}>
            {m}m
          </option>
        ))}
      </select>

      <button
        type="submit"
        disabled={!isValid || isLocked}
        aria-label="Add task"
      >
        +
      </button>
    </form>
  );
}

export default CreateForm;
