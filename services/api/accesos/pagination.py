"""Pagination helpers for API safety."""

from rest_framework.pagination import PageNumberPagination


class SafePageNumberPagination(PageNumberPagination):
    """PageNumber pagination with server-side hard limit."""

    page_size = 20
    page_size_query_param = "page_size"
    max_page_size = 100

    def get_page_size(self, request):
        size = super().get_page_size(request)
        if size is None:
            return self.page_size
        return min(int(size), self.max_page_size)
