import { Component, type ReactNode } from 'react'

export default class PageErrorBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  render() {
    if (!this.state.failed) return this.props.children

    return (
      <section className="page-load-error" aria-labelledby="page-load-heading">
        <h1 id="page-load-heading" role="alert">
          Không mở được trang
        </h1>
        <p>Thử mở lại nội dung hoặc chọn mục khác trong menu.</p>
        <button type="button" onClick={() => this.setState({ failed: false })}>
          Thử lại
        </button>
      </section>
    )
  }
}
