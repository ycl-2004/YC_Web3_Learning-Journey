import { useState } from "react";
function EditForm({ todo, editTodo }) {
  const [task, setTask] = useState(todo.content);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (task.trim() === "") return;
    editTodo(todo.id, task);
  };

  return (
    <form className="create-form" onSubmit={handleSubmit}>
      <input
        type="text"
        placeholder="Add a new task"
        value={task}
        onChange={(e) => setTask(e.target.value)}
      />
      <button type="submit">Complete</button>
    </form>
  );
}

export default EditForm;
