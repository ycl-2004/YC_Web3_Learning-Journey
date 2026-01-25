import {
  MdDelete,
  MdEdit,
  MdPlayArrow,
  MdPause,
  MdCheckCircle,
} from "react-icons/md";
import EditForm from "./EditForm.jsx";

function Todo({
  todo,
  deleteTodo,
  toggleComplete,
  toggleIsEditing,
  editTodo,
  isLocked,
  isActive,
  canStart,
  status,
  onStart,
  onPause,
  onFinish,
}) {
  if (todo.isEditing) {
    return (
      <div className="todo editing">
        <EditForm
          todo={todo}
          toggleIsEditing={toggleIsEditing}
          editTodo={editTodo}
          isLocked={isLocked}
        />
      </div>
    );
  }

  const disableRow = isLocked && !isActive;
  const isRunning = isActive && status === "running";
  const isPaused = isActive && status === "paused";

  return (
    <div
      className={`todo ${todo.isCompleted ? "completed" : ""} ${disableRow ? "locked" : ""}`}
    >
      <div className="todo-left">
        <input
          className="checkbox"
          type="checkbox"
          checked={todo.isCompleted}
          onChange={() => toggleComplete(todo.id)}
          disabled={disableRow || isLocked} // active 時也禁止手動勾（用 Finish 控制）
        />
        <div className="todo-main">
          <span className="todo-text" title={todo.content}>
            {todo.content}
          </span>
          <span className="todo-meta">{todo.minutes ?? 25}m</span>
        </div>
      </div>

      <div className="todo-actions">
        {/* Focus controls */}
        {isActive ? (
          <>
            <button
              className="icon-btn"
              onClick={isRunning ? onPause : onStart}
              aria-label={isRunning ? "Pause" : "Start"}
              title={isRunning ? "Pause" : "Start"}
            >
              {isRunning ? <MdPause /> : <MdPlayArrow />}
            </button>
            <button
              className="icon-btn ok"
              onClick={onFinish}
              aria-label="Finish"
              title="Finish"
            >
              <MdCheckCircle />
            </button>
          </>
        ) : (
          <button
            className="icon-btn"
            onClick={onStart}
            aria-label="Start"
            title={canStart ? "Start" : "Start (only the next task in order)"}
            disabled={!canStart || isLocked}
          >
            <MdPlayArrow />
          </button>
        )}

        {/* Edit/Delete (disabled when locked) */}
        <button
          className="icon-btn"
          onClick={() => toggleIsEditing(todo.id)}
          aria-label="Edit"
          title="Edit"
          disabled={isLocked}
        >
          <MdEdit />
        </button>

        <button
          className="icon-btn danger"
          onClick={() => deleteTodo(todo.id)}
          aria-label="Delete"
          title="Delete"
          disabled={isLocked}
        >
          <MdDelete />
        </button>
      </div>
    </div>
  );
}

export default Todo;
