import { useState } from "react";
import MinuteSelect from "./MinuteSelect";

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

      <MinuteSelect
        value={minutes}
        onChange={setMinutes}
        disabled={isLocked}
        ariaLabel="Task minutes"
      />

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
